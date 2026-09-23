import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import Camera from '../components/Camera';
import { Icon } from '../components/ui';

export default function CheckIn() {
  const { id } = useParams();
  const cam = useRef(null);
  const [face, setFace] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {ok, message, score}

  useEffect(() => { api('/face/status').then(setFace).catch(() => {}); }, []);

  const verify = async () => {
    const image = cam.current?.capture();
    if (!image) return setResult({ ok: false, message: 'Camera not ready yet.' });
    setBusy(true); setResult(null);
    try {
      const r = await api(`/sessions/${id}/checkin`, { method: 'POST', body: { image } });
      if (r.matched) setResult({ ok: true, score: r.score, message: r.already ? 'You were already marked present.' : 'Attendance marked!' });
      else setResult({ ok: false, score: r.score, message: 'Face did not match. Try again in better light, facing the camera.' });
    } catch (e) { setResult({ ok: false, message: e.message }); } finally { setBusy(false); }
  };

  if (result?.ok) {
    return (
      <div className="card result ok">
        <span className="big-check"><Icon name="check" size={40} /></span>
        <h1>{result.message}</h1>
        {result.score !== undefined && <p className="muted">Face similarity: {Math.round(result.score * 100)}%</p>}
        <Link className="btn" to="/">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <>
      <Link to="/" className="back"><Icon name="back" /> Back</Link>
      <div className="page-head"><h1>Mark attendance</h1><p className="muted">Look at the camera and press Verify.</p></div>

      {face && !face.registered ? (
        <div className="card notice">
          <div><h3>Register your face first</h3><p className="muted">We need your photos before we can verify you.</p></div>
          <Link className="btn" to="/face">Register face</Link>
        </div>
      ) : (
        <div className="card narrow-card">
          <Camera ref={cam} />
          {result && !result.ok && (
            <div className="alert">{result.message}{result.score !== undefined && ` (similarity ${Math.round(result.score * 100)}%)`}</div>
          )}
          <button className="btn block" onClick={verify} disabled={busy}>{busy ? 'Verifying…' : 'Verify & mark present'}</button>
        </div>
      )}
    </>
  );
}
