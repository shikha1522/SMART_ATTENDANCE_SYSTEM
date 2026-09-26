import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import Camera from '../components/Camera';
import { Icon } from '../components/ui';

// steps: intro -> center -> turning -> submitting -> done
const HOLD_MS = 900;   // how long we show the arrow before capturing the "turned" shot

export default function CheckIn() {
  const { id } = useParams();
  const cam = useRef(null);
  const [face, setFace] = useState(null);
  const [step, setStep] = useState('intro');
  const [challenge, setChallenge] = useState(null);
  const [result, setResult] = useState(null); // {ok, message, score}

  useEffect(() => { api('/face/status').then(setFace).catch(() => {}); }, []);

  const start = async () => {
    setResult(null);
    let ch;
    try { ch = (await api(`/sessions/${id}/checkin/challenge`)).challenge; }
    catch { ch = Math.random() < 0.5 ? 'left' : 'right'; }
    setChallenge(ch);
    setStep('center');
  };

  const captureBaseline = () => {
    const baseline = cam.current?.capture();
    if (!baseline) return setResult({ ok: false, message: 'Camera not ready yet.' });
    setStep('turning');
    setTimeout(async () => {
      const turned = cam.current?.capture();
      setStep('submitting');
      try {
        const r = await api(`/sessions/${id}/checkin`, { method: 'POST', body: { baseline, turned, challenge } });
        if (r.matched) {
          setResult({ ok: true, score: r.score, message: r.already ? 'You were already marked present.' : 'Attendance marked!' });
          setStep('done');
        } else if (r.liveness === false) {
          setResult({ ok: false, message: r.message });
          setStep('center');
        } else {
          setResult({ ok: false, score: r.score, message: 'Face did not match. Make sure it is you, in good light.' });
          setStep('center');
        }
      } catch (e) {
        setResult({ ok: false, message: e.message });
        setStep('center');
      }
    }, HOLD_MS);
  };

  if (step === 'done' && result?.ok) {
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
      <div className="page-head"><h1>Mark attendance</h1><p className="muted">We'll ask you to turn your head to prove it's really you, live.</p></div>

      {face && !face.registered ? (
        <div className="card notice">
          <div><h3>Register your face first</h3><p className="muted">We need your photos before we can verify you.</p></div>
          <Link className="btn" to="/face">Register face</Link>
        </div>
      ) : (
        <div className="card narrow-card">
          <div className={`camera-wrap ${step === 'turning' ? `turning-${challenge}` : ''}`}>
            <Camera ref={cam} />
            {step === 'turning' && (
              <div className={`arrow-overlay dir-${challenge}`}>
                <Icon name={challenge === 'left' ? 'back' : 'forward'} size={48} />
                <span>Turn {challenge}</span>
              </div>
            )}
            {step === 'submitting' && <div className="cam-loading">Verifying…</div>}
          </div>

          {result && !result.ok && (
            <div className="alert">{result.message}{result.score !== undefined && ` (similarity ${Math.round(result.score * 100)}%)`}</div>
          )}

          {step === 'intro' && (
            <button className="btn block" onClick={start}>Start check-in</button>
          )}
          {step === 'center' && (
            <>
              <p className="prompt">Look straight at the camera, then press the button</p>
              <button className="btn block" onClick={captureBaseline}>I'm ready</button>
            </>
          )}
          {(step === 'turning' || step === 'submitting') && (
            <button className="btn block" disabled>{step === 'turning' ? 'Hold still…' : 'Verifying…'}</button>
          )}
        </div>
      )}
    </>
  );
}
