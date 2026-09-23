import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Logo, Icon } from '../components/ui';

export function AuthHero() {
  return (
    <aside className="auth-hero">
      <div className="hero-brand"><Logo size={44} /> <span>SmartAttend</span></div>
      <h1>Attendance that knows who, where, and for how long.</h1>
      <ul>
        <li><Icon name="check" /> Face recognition &amp; liveness</li>
        <li><Icon name="check" /> Location &amp; classroom verification</li>
        <li><Icon name="check" /> Partial attendance &amp; anomaly alerts</li>
      </ul>
    </aside>
  );
}

export default function Login() {
  const [f, setF] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const submit = async (ev) => {
    ev.preventDefault();
    setErr(''); setBusy(true);
    try {
      login(await api('/auth/login', { method: 'POST', body: f }));
      nav('/');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <AuthHero />
      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <div className="mobile-brand"><Logo size={40} /> <span>SmartAttend</span></div>
          <h2>Welcome back</h2>
          <p className="muted mb">Log in to continue.</p>
          {err && <div className="alert">{err}</div>}
          <label className="field"><span>Email</span>
            <input type="email" autoComplete="email" placeholder="you@college.edu" value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value })} required />
          </label>
          <label className="field"><span>Password</span>
            <div className="pw">
              <input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••"
                value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
              <button type="button" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button>
            </div>
          </label>
          <button className="btn block" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
          <p className="center-text muted">New here? <Link to="/register">Create an account</Link></p>
        </form>
      </section>
    </div>
  );
}
