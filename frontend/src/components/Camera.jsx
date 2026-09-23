import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Live camera preview. Parent calls ref.current.capture() to get a JPEG data URL (or null).
const Camera = forwardRef(function Camera({ facing = 'user' }, ref) {
  const video = useRef(null);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErr(window.isSecureContext
          ? 'This browser does not support camera access.'
          : 'The camera only works on https:// or localhost. On your phone, open the app using the HTTPS address (see README).');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
        });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.current.srcObject = stream;
        await video.current.play();
        setReady(true);
      } catch (e) {
        setErr(e.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access in your browser settings and reload.'
          : `Could not open the camera: ${e.message}`);
      }
    })();
    return () => { stopped = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, [facing]);

  useImperativeHandle(ref, () => ({
    capture() {
      const v = video.current;
      if (!v || !v.videoWidth) return null;
      const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.9);
    },
  }));

  if (err) return <div className="alert">{err}</div>;
  return (
    <div className="camera">
      <video ref={video} muted playsInline className="mirror" />
      {!ready && <div className="cam-loading">Starting camera…</div>}
      <div className="face-guide" />
    </div>
  );
});

export default Camera;
