import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, DAYS, fmtTime } from '../api';
import { useToast } from '../components/Toast';
import { Avatar, Ring, Bar, Icon, Spinner, Empty, pctTone, colorFor } from '../components/ui';

function tip(c) {
  if (!c.total) return 'No classes recorded yet';
  if (c.percentage >= 75) {
    const skip = Math.floor((4 * c.present) / 3 - c.total);
    return skip > 0 ? `You can miss ${skip} more class${skip > 1 ? 'es' : ''} and stay at 75%` : 'Right at the 75% line — don’t miss the next one';
  }
  const need = 3 * c.total - 4 * c.present;
  return `Attend the next ${need} class${need > 1 ? 'es' : ''} in a row to reach 75%`;
}

export default function StudentDashboard() {
  const toast = useToast();
  const [me, setMe] = useState(null);
  const [att, setAtt] = useState(null);
  const [tt, setTt] = useState([]);
  const [hist, setHist] = useState([]);
  const [tab, setTab] = useState('overview');
  const [face, setFace] = useState(null);
  const [live, setLive] = useState([]);

  useEffect(() => {
    Promise.all([api('/auth/me'), api('/attendance/me'), api('/courses/timetable/me'), api('/attendance/me/history'),
      api('/face/status'), api('/attendance/me/active')])
      .then(([m, a, t, h, f, l]) => { setMe(m); setAtt(a); setTt(t); setHist(h); setFace(f); setLive(l); })
      .catch((e) => toast(e.message, 'err'));
    // keep the "live now" list fresh
    const timer = setInterval(() => api('/attendance/me/active').then(setLive).catch(() => {}), 8000);
    return () => clearInterval(timer);
  }, []);

  if (!att) return <Spinner />;
  const today = new Date().getDay();
  const byDay = DAYS.map((d, i) => ({ d, i, slots: tt.filter((t) => t.day === i) })).filter((g) => g.slots.length);

  return (
    <>
      <div className="profile">
        <Avatar name={me?.name} size={56} />
        <div>
          <h1>{me?.name}</h1>
          <p className="muted">{me?.roll_no}{me?.branch ? ` · ${me.branch}` : ''}{me?.semester ? ` · Semester ${me.semester}` : ''}</p>
        </div>
      </div>

      <div className="seg tabs">
        {[['overview', 'Overview'], ['timetable', 'Timetable'], ['history', 'History']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          {face && !face.registered && (
            <div className="card notice">
              <div><h3>Register your face</h3><p className="muted">Required before you can mark attendance.</p></div>
              <Link className="btn" to="/face">Register face</Link>
            </div>
          )}
          {live.map((s) => (
            <div key={s.session_id} className="card notice live">
              <div>
                <span className="badge live">● Live now</span>
                <h3>{s.course_name}</h3>
                <p className="sub">Started {new Date(s.started_at).toLocaleTimeString([], { timeStyle: 'short' })}</p>
              </div>
              {s.status === 'present'
                ? <span className="badge present">Marked present</span>
                : <Link className="btn" to={`/checkin/${s.session_id}`}>Mark attendance</Link>}
            </div>
          ))}
          <div className="card overall">
            <Ring value={att.overall} />
            <div>
              <h3>Overall attendance</h3>
              <p className="muted">
                {att.overall === null ? 'Your attendance will appear after the first completed class.'
                  : att.overall >= 75 ? 'You’re above the 75% requirement. Keep it up!'
                  : 'You’re below the 75% requirement.'}
              </p>
            </div>
          </div>

          <h2 className="section">By course</h2>
          {att.courses.length ? (
            <div className="grid-cards">
              {att.courses.map((c) => (
                <div key={c.course_id} className="card course-stat" style={{ '--accent': colorFor(c.code) }}>
                  <div className="row-between">
                    <div>
                      <span className="badge">{c.code}</span>
                      <h3>{c.name}</h3>
                    </div>
                    <b className={`pct ${pctTone(c.percentage)}`}>{c.percentage ?? '—'}{c.percentage !== null && '%'}</b>
                  </div>
                  <Bar value={c.percentage} tone={pctTone(c.percentage)} />
                  <p className="sub">{c.present}/{c.total} classes attended</p>
                  <p className="tip">{tip(c)}</p>
                </div>
              ))}
            </div>
          ) : <div className="card"><Empty icon="book" title="Not enrolled yet">Ask your teacher to enroll your roll number.</Empty></div>}
        </>
      )}

      {tab === 'timetable' && (
        byDay.length ? byDay.map((g) => (
          <div key={g.i} className="card">
            <h3>{g.d} {g.i === today && <span className="badge live">Today</span>}</h3>
            <div className="list">
              {g.slots.map((t) => (
                <div key={t.id} className="item">
                  <span className="time">{fmtTime(t.start_time)}<small>{fmtTime(t.end_time)}</small></span>
                  <div className="grow">
                    <div className="title">{t.course_name}</div>
                    <div className="sub"><Icon name="building" size={13} /> {t.room_name || 'Room not set'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )) : <div className="card"><Empty icon="calendar" title="No timetable yet">Your teachers haven’t added any slots.</Empty></div>
      )}

      {tab === 'history' && (
        <div className="card">
          {hist.length ? (
            <div className="list">
              {hist.map((h) => (
                <div key={h.session_id} className="item">
                  <div className="grow">
                    <div className="title">{h.course_name}</div>
                    <div className="sub">{new Date(h.started_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                  </div>
                  <span className={`badge ${h.status}`}>{h.status}</span>
                </div>
              ))}
            </div>
          ) : <Empty icon="clock" title="No completed sessions yet" />}
        </div>
      )}
    </>
  );
}
