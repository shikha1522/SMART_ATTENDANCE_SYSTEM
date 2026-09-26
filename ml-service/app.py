"""
SmartAttend ML service (Phase 2): face detection + face embedding + verification.

  POST /embed   {image}                -> {embedding[128], det_score}
  POST /verify  {image, embeddings[]}  -> {score, match, threshold}
  GET  /health

Models (downloaded automatically on first start into ./models):
  * YuNet  - face detector
  * SFace  - face recognition (128-d embedding)
"""
import base64
import os
import threading
import urllib.request

import cv2
import numpy as np
from flask import Flask, jsonify, request

BASE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE, "models")
DET_PATH = os.path.join(MODEL_DIR, "face_detection_yunet_2023mar.onnx")
REC_PATH = os.path.join(MODEL_DIR, "face_recognition_sface_2021dec.onnx")
MODEL_URLS = {
    DET_PATH: "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx",
    REC_PATH: "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx",
}

FACE_THRESHOLD = float(os.getenv("FACE_THRESHOLD", "0.40"))  # cosine similarity needed to accept
MIN_DET_SCORE = 0.85   # detector confidence
MIN_FACE_PX = 70       # face width in pixels (after resizing to max 640px)
MAX_SIDE = 640

# Phase 3: liveness (head-turn challenge)
LIVENESS_MIN_SHIFT = float(os.getenv("LIVENESS_MIN_SHIFT", "0.12"))  # min normalised nose shift to count as a turn
LIVENESS_MAX_SHIFT = float(os.getenv("LIVENESS_MAX_SHIFT", "0.9"))   # above this, treat as a bad detection, not a huge turn
# If "left"/"right" come out reversed for your camera, set LIVENESS_FLIP=1 (see README).
LIVENESS_FLIP = os.getenv("LIVENESS_FLIP", "0") == "1"

app = Flask(__name__)
lock = threading.Lock()      # OpenCV detector/recognizer objects are not thread-safe
detector = None
recognizer = None


class ApiError(Exception):
    def __init__(self, code, message, status=422):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


@app.errorhandler(ApiError)
def handle_api_error(e):
    return jsonify({"error": e.code, "message": e.message}), e.status


@app.errorhandler(Exception)
def handle_unexpected(e):
    app.logger.exception(e)
    return jsonify({"error": "server_error", "message": "Face service failed unexpectedly"}), 500


# ---------------------------------------------------------------- models
def ensure_models():
    os.makedirs(MODEL_DIR, exist_ok=True)
    for path, url in MODEL_URLS.items():
        if os.path.exists(path) and os.path.getsize(path) > 100_000:
            continue
        print(f"Downloading {os.path.basename(path)} ...", flush=True)
        tmp = path + ".part"
        urllib.request.urlretrieve(url, tmp)
        if os.path.getsize(tmp) < 100_000:   # a git-lfs pointer file, not the real model
            os.remove(tmp)
            raise RuntimeError(f"Download of {url} failed. Download it manually and put it in the models/ folder.")
        os.replace(tmp, path)


def load_models():
    global detector, recognizer
    ensure_models()
    detector = cv2.FaceDetectorYN.create(DET_PATH, "", (320, 320), 0.8, 0.3, 5000)
    recognizer = cv2.FaceRecognizerSF.create(REC_PATH, "")
    print("Models loaded.", flush=True)


# ---------------------------------------------------------------- helpers
def decode_image(data):
    if not isinstance(data, str) or not data:
        raise ApiError("bad_image", "No image received")
    b64 = data.split(",", 1)[1] if data.startswith("data:") else data
    try:
        raw = base64.b64decode(b64)
    except Exception:
        raise ApiError("bad_image", "Image data is not valid")
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ApiError("bad_image", "Could not read the image")
    h, w = img.shape[:2]
    scale = MAX_SIDE / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def detect_single_face(img):
    """Return the OpenCV face row [x,y,w,h, 5x(landmark x,y), score] for the one face in img."""
    h, w = img.shape[:2]
    with lock:
        detector.setInputSize((w, h))
        _, faces = detector.detect(img)
    faces = [] if faces is None else [f for f in faces if f[14] >= MIN_DET_SCORE]
    if not faces:
        raise ApiError("no_face", "No face found. Face the camera in good light.")
    if len(faces) > 1:
        raise ApiError("multiple_faces", "More than one face in the photo. Only you should be visible.")
    face = faces[0]
    if face[2] < MIN_FACE_PX:
        raise ApiError("face_too_small", "Face is too small. Move closer to the camera.")
    return face


def embed_image(img):
    """Return (embedding, detector_score) for the single face in img, or raise ApiError."""
    face = detect_single_face(img)
    with lock:
        aligned = recognizer.alignCrop(img, face)
        feat = recognizer.feature(aligned)
    feat = np.asarray(feat, dtype=np.float32).flatten()
    feat /= np.linalg.norm(feat) + 1e-9
    return feat, float(face[14])


def yaw_of(face):
    """Horizontal nose position relative to the eyes, normalised by eye spacing.
    ~0 = facing the camera; positive/negative = turned one way or the other."""
    re_x, le_x, nose_x = face[4], face[6], face[8]
    eye_dist = abs(le_x - re_x)
    if eye_dist < 1e-3:
        raise ApiError("face_too_small", "Could not read the face angle. Move closer and try again.")
    return (nose_x - (re_x + le_x) / 2) / eye_dist


# ---------------------------------------------------------------- routes
@app.get("/health")
def health():
    return jsonify({"ok": True, "models_loaded": detector is not None and recognizer is not None,
                    "threshold": FACE_THRESHOLD})


@app.post("/embed")
def embed():
    body = request.get_json(silent=True) or {}
    feat, det = embed_image(decode_image(body.get("image")))
    return jsonify({"embedding": feat.tolist(), "det_score": det})


@app.post("/verify")
def verify():
    body = request.get_json(silent=True) or {}
    stored = body.get("embeddings")
    if not isinstance(stored, list) or not stored:
        raise ApiError("no_embeddings", "No registered face to compare with", 400)
    try:
        ref = np.asarray(stored, dtype=np.float32)
        if ref.ndim != 2 or ref.shape[1] != 128:
            raise ValueError
    except Exception:
        raise ApiError("bad_embeddings", "Stored face data is invalid", 400)
    ref /= np.linalg.norm(ref, axis=1, keepdims=True) + 1e-9

    feat, det = embed_image(decode_image(body.get("image")))
    score = float(np.max(ref @ feat))    # best cosine similarity against the registered photos
    return jsonify({"score": round(score, 4), "match": score >= FACE_THRESHOLD,
                    "threshold": FACE_THRESHOLD, "det_score": det})


@app.post("/liveness")
def liveness():
    """Verify the student actually turned their head between two photos (anti-photo-spoof, Phase 3).
    Body: {baseline, turned, challenge: "left"|"right"}."""
    body = request.get_json(silent=True) or {}
    challenge = body.get("challenge")
    if challenge not in ("left", "right"):
        raise ApiError("bad_challenge", "challenge must be 'left' or 'right'", 400)

    base_face = detect_single_face(decode_image(body.get("baseline")))
    turn_face = detect_single_face(decode_image(body.get("turned")))
    shift = yaw_of(turn_face) - yaw_of(base_face)
    signed = -shift if LIVENESS_FLIP else shift

    if abs(signed) > LIVENESS_MAX_SHIFT:
        direction, live = "none", False
    elif signed > LIVENESS_MIN_SHIFT:
        direction, live = "right", challenge == "right"
    elif signed < -LIVENESS_MIN_SHIFT:
        direction, live = "left", challenge == "left"
    else:
        direction, live = "none", False

    print(f"[liveness] asked={challenge} detected={direction} shift={shift:.4f} flip={LIVENESS_FLIP}", flush=True)
    return jsonify({"live": live, "challenge": challenge, "detected_direction": direction,
                    "shift": round(float(shift), 4)})

if __name__ == "__main__":
    from waitress import serve
    load_models()
    port = int(os.getenv("PORT", "8000"))
    print(f"ML service on http://localhost:{port}", flush=True)
    serve(app, host="127.0.0.1", port=port, threads=4)
