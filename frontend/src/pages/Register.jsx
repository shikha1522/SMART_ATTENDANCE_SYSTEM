import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { Logo } from '../components/ui';
import { AuthHero } from './Login';

export default function Register() {
  const [f, setF] = useState({ role: 'student', name: '', email: '', password: '', roll_no: '', branch: '', semester: '', department: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (ev) => {
    ev.preventDefault();
    setErr(''); setBusy(true);
    try {
      login(await api('/auth/register', { method: 'POST', body: { ...f, semester: f.semester ? Number(f.semester) : null } }));
      nav('/');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <AuthHero />
      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <div className="mobile-brand"><Logo size={40} /> <span>SmartAttend</span></div>
          <h2>Create your account</h2>
          <p className="muted mb">I am a…</p>
          <div className="seg mb">
            <button type="button" className={f.role === 'student' ? 'on' : ''} onClick={() => setF({ ...f, role: 'student' })}>Student</button>
            <button type="button" className={f.role === 'teacher' ? 'on' : ''} onClick={() => setF({ ...f, role: 'teacher' })}>Teacher</button>
          </div>
          {err && <div className="alert">{err}</div>}
          <label className="field"><span>Full name</span><input value={f.name} onChange={set('name')} required /></label>
          <label className="field"><span>Email</span><input type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></label>
          <label className="field"><span>Password</span><input type="password" autoComplete="new-password" placeholder="At least 6 characters" value={f.password} onChange={set('password')} required /></label>
          {f.role === 'student' ? (
            <>
              <label className="field"><span>Roll number</span><input value={f.roll_no} onChange={set('roll_no')} required /></label>
              <div className="two">
                <label className="field"><span>Branch</span><input placeholder="CSE" value={f.branch} onChange={set('branch')} /></label>
                <label className="field"><span>Semester</span><input type="number" min="1" max="12" value={f.semester} onChange={set('semester')} /></label>
              </div>
            </>
          ) : (
            <label className="field"><span>Department</span><input value={f.department} onChange={set('department')} /></label>
          )}
          <button className="btn block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
          <p className="center-text muted">Already have an account? <Link to="/login">Log in</Link></p>
        </form>
      </section>
    </div>
  );
}
