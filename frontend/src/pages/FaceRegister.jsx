import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../components/Toast';
import Camera from '../components/Camera';
import { Icon } from '../components/ui';

const PROMPTS = [
  'Look straight at the camera',
  'Turn your head slightly to the left',
  'Turn your head slightly to the right',
  'Tilt your chin up a little',
  'Smile naturally',
];

export default function FaceRegister() {
  const cam = useRef(null);
  const nav = useNavigate();
  const toast = useToast();
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { api('/face/status').then(setStatus).catch(() => {}); }, []);

  const capture = () => {
    const img = cam.current?.capture();
    if (!img) return toast('Camera not ready yet', 'err');
    setPhotos((p) => [...p, img]);
    setErr('');
  };

  const save = async () => {
    setBusy(true); setErr('');
    try {
      await api('/face/register', { method: 'POST', body: { images: photos } });
      toast('Face registered ✔');
      nav('/');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const step = Math.min(photos.length, PROMPTS.length - 1);
  const done = photos.length >= PROMPTS.length;

  return (
    <>
      <Link to="/" className="back"><Icon name="back" /> Back</Link>
      <div className="page-head">
        <h1>Register your face</h1>
        <p className="muted">
          {status?.registered ? 'Your face is already registered. Taking new photos will replace it.'
            : 'Take 5 quick photos so we can recognise you when you mark attendance.'}
        </p>
      </div>

      <div className="cols">
        <div className="card">
          <Camera ref={cam} />
          <p className="prompt">{done ? 'All photos taken ✔' : `${photos.length + 1}/${PROMPTS.length} · ${PROMPTS[step]}`}</p>
          {err && <div className="alert">{err}</div>}
          <div className="actions">
            <button className="btn" onClick={capture} disabled={done || busy}><Icon name="plus" /> Capture photo</button>
            <button className="btn soft" onClick={save} disabled={photos.length < 3 || busy}>
              {busy ? 'Checking photos…' : `Save (${photos.length})`}
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Your photos</h3>
          {photos.length ? (
            <div className="thumbs">
              {photos.map((p, i) => (
                <div key={i} className="thumb">
                  <img src={p} alt={`Photo ${i + 1}`} />
                  <button aria-label="Remove photo" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}><Icon name="x" size={14} /></button>
                </div>
              ))}
            </div>
          ) : <p className="muted">No photos yet.</p>}
          <ul className="tips">
            <li>Good, even lighting on your face</li>
            <li>Only you in the frame; no hat or mask</li>
            <li>Keep your face inside the oval</li>
          </ul>
        </div>
      </div>
    </>
  );
}
