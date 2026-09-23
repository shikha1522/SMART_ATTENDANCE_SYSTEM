import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, DAYS, fmtTime } from '../api';
import { useToast } from '../components/Toast';
import { Icon, Avatar, Bar, Spinner, Empty, colorFor } from '../components/ui';

export default function CourseDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [tab, setTab] = useState('attendance');
  const [roll, setRoll] = useState('');
  const [slot, setSlot] = useState({ day: 1, start_time: '09:00', end_time: '10:00', room_id: '' });

  const load = async () => {
    setData(await api(`/courses/${id}`));
    setSessions(await api(`/courses/${id}/sessions`));
    setRooms(await api('/courses/rooms/all'));
  };
  useEffect(() => { load().catch((e) => toast(e.message, 'err')); }, [id]);

  const run = (fn, okMsg) => async (...a) => {
    try { await fn(...a); if (okMsg) toast(okMsg); await load(); } catch (e) { toast(e.message, 'err'); }
  };

  const enroll = run(async (ev) => {
    ev.preventDefault();
    await api(`/courses/${id}/enroll`, { method: 'POST', body: { roll_no: roll } });
    setRoll('');
  }, 'Student enrolled');
  const unenroll = run((sid) => api(`/courses/${id}/enroll/${sid}`, { method: 'DELETE' }), 'Student removed');
  const addSlot = run(async (ev) => {
    ev.preventDefault();
    await api(`/courses/${id}/timetable`, { method: 'POST', body: { ...slot, day: Number(slot.day), room_id: slot.room_id || null } });
  }, 'Slot added');
  const delSlot = run((sid) => api(`/courses/${id}/timetable/${sid}`, { method: 'DELETE' }), 'Slot removed');

  const startSession = async () => {
    try { const s = await api(`/courses/${id}/sessions`, { method: 'POST' }); nav(`/session/${s.id}`); }
    catch (e) { toast(e.message, 'err'); }
  };

  if (!data) return <Spinner />;
  const { course, students, timetable } = data;
  const active = sessions.find((s) => s.status === 'active');

  return (
    <>
      <Link to="/" className="back"><Icon name="back" /> All courses</Link>

      <div className="course-hero" style={{ '--accent': colorFor(course.code) }}>
        <div>
          <span className="badge light">{course.code}</span>
          <h1>{course.name}</h1>
          <p>{students.length} students · {timetable.length} weekly slots</p>
        </div>
        {active
          ? <Link className="btn light" to={`/session/${active.id}`}><Icon name="play" /> Resume session</Link>
          : <button className="btn light" onClick={startSession}><Icon name="play" /> Start session</button>}
      </div>

      <div className="seg tabs">
        {[['attendance', 'Attendance'], ['students', 'Students'], ['timetable', 'Timetable']].map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'attendance' && (
        <div className="card">
          <h3>Sessions</h3>
          {sessions.length ? (
            <div className="list">
              {sessions.map((s) => {
                const pct = s.total ? Math.round((s.present / s.total) * 100) : 0;
                return (
                  <Link key={s.id} to={`/session/${s.id}`} className="item click">
                    <div className="grow">
                      <div className="title">{new Date(s.started_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                      <div className="sub">{s.present}/{s.total} present</div>
                      <Bar value={pct} tone="green" />
                    </div>
                    <span className={`badge ${s.status === 'active' ? 'live' : ''}`}>{s.status === 'active' ? '● Live' : 'Ended'}</span>
                    <Icon name="chevron" />
                  </Link>
                );
              })}
            </div>
          ) : <Empty icon="clock" title="No sessions yet">Press “Start session” to take attendance.</Empty>}
        </div>
      )}

      {tab === 'students' && (
        <div className="card">
          <h3>Enrolled students ({students.length})</h3>
          <form className="inline" onSubmit={enroll}>
            <input placeholder="Enter roll number to enroll" value={roll} onChange={(e) => setRoll(e.target.value)} required />
            <button className="btn"><Icon name="plus" /> <span className="hide-sm">Enroll</span></button>
          </form>
          {students.length ? (
            <div className="list">
              {students.map((s) => (
                <div key={s.id} className="item">
                  <Avatar name={s.name} />
                  <div className="grow">
                    <div className="title">{s.name}</div>
                    <div className="sub">{s.roll_no}{s.branch ? ` · ${s.branch}` : ''}{s.semester ? ` · Sem ${s.semester}` : ''}</div>
                  </div>
                  <button className="btn danger sm" onClick={() => confirm(`Remove ${s.name}?`) && unenroll(s.id)}><Icon name="trash" size={15} /></button>
                </div>
              ))}
            </div>
          ) : <Empty icon="users" title="No students enrolled">Students must register first, then enroll them with their roll number.</Empty>}
        </div>
      )}

      {tab === 'timetable' && (
        <div className="cols">
          <form className="card" onSubmit={addSlot}>
            <h3>Add a slot</h3>
            <label className="field"><span>Day</span>
              <select value={slot.day} onChange={(e) => setSlot({ ...slot, day: e.target.value })}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select></label>
            <div className="two">
              <label className="field"><span>Start</span><input type="time" value={slot.start_time} onChange={(e) => setSlot({ ...slot, start_time: e.target.value })} required /></label>
              <label className="field"><span>End</span><input type="time" value={slot.end_time} onChange={(e) => setSlot({ ...slot, end_time: e.target.value })} required /></label>
            </div>
            <label className="field"><span>Room</span>
              <select value={slot.room_id} onChange={(e) => setSlot({ ...slot, room_id: e.target.value })}>
                <option value="">No room</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select></label>
            <button className="btn block"><Icon name="plus" /> Add slot</button>
          </form>

          <div className="card">
            <h3>Weekly schedule</h3>
            {timetable.length ? (
              <div className="list">
                {timetable.map((t) => (
                  <div key={t.id} className="item">
                    <span className="daybox">{DAYS[t.day].slice(0, 3)}</span>
                    <div className="grow">
                      <div className="title">{fmtTime(t.start_time)} – {fmtTime(t.end_time)}</div>
                      <div className="sub">{t.room_name || 'No room'}</div>
                    </div>
                    <button className="btn ghost sm" onClick={() => delSlot(t.id)} aria-label="Delete slot"><Icon name="x" size={15} /></button>
                  </div>
                ))}
              </div>
            ) : <Empty icon="calendar" title="No slots yet">Add the first weekly class slot.</Empty>}
          </div>
        </div>
      )}
    </>
  );
}
