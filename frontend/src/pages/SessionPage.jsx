import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import { useToast } from '../components/Toast';
import { Icon, Avatar, Bar, Spinner, Empty } from '../components/ui';

const STATUSES = ['present', 'partial', 'absent'];

export default function SessionPage() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const load = () => api(`/sessions/${id}`).then(setData).catch((e) => toast(e.message, 'err'));
  useEffect(() => { load(); }, [id]);

  // while the session is live, refresh so teachers see students check in
  const live = data?.session.status === 'active';
  useEffect(() => {
    if (!live) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [live, id]);

  const mark = async (sid, status) => {
    setData((d) => ({ ...d, records: d.records.map((r) => (r.student_id === sid ? { ...r, status } : r)) }));
    try { await api(`/sessions/${id}/records/${sid}`, { method: 'PATCH', body: { status } }); }
    catch (e) { toast(e.message, 'err'); load(); }
  };

  const markAll = async () => {
    const targets = data.records.filter((r) => r.status !== 'present');
    setData((d) => ({ ...d, records: d.records.map((r) => ({ ...r, status: 'present' })) }));
    try {
      await Promise.all(targets.map((r) => api(`/sessions/${id}/records/${r.student_id}`, { method: 'PATCH', body: { status: 'present' } })));
      toast('Everyone marked present');
    } catch (e) { toast(e.message, 'err'); load(); }
  };

  const end = async () => {
    if (!confirm('End this session? Attendance will be finalised.')) return;
    try { await api(`/sessions/${id}/end`, { method: 'POST' }); toast('Session ended'); load(); }
    catch (e) { toast(e.message, 'err'); }
  };

  if (!data) return <Spinner />;
  const { session, records } = data;
  const active = session.status === 'active';
  const count = (s) => records.filter((r) => r.status === s).length;
  const present = count('present');
  const pct = records.length ? Math.round((present / records.length) * 100) : 0;

  const shown = records.filter((r) =>
    (filter === 'all' || r.status === filter) &&
    (`${r.name} ${r.roll_no}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <Link to={`/course/${session.course_id}`} className="back"><Icon name="back" /> {session.course_name}</Link>

      <div className="card session-head">
        <div className="grow">
          <div className="row-wrap">
            <h1>{session.course_name}</h1>
            <span className={`badge ${active ? 'live' : ''}`}>{active ? '● Live' : 'Ended'}</span>
          </div>
          <p className="muted">{new Date(session.started_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
        <div className="session-count"><b>{present}</b><span>/ {records.length} present</span></div>
        <div className="full"><Bar value={pct} tone="green" /></div>
        {active && (
          <div className="actions full">
            <button className="btn soft" onClick={markAll}><Icon name="check" /> Mark all present</button>
            <button className="btn danger" onClick={end}><Icon name="stop" size={16} /> End session</button>
          </div>
        )}
      </div>
      {active && <p className="hint">Students can now mark themselves with face verification. You can still override manually.</p>}

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={16} />
          <input placeholder="Search name or roll no" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="chips scroll">
          {['all', ...STATUSES].map((s) => (
            <button key={s} className={`chip btnchip ${filter === s ? 'on' : ''}`} onClick={() => setFilter(s)}>
              {s === 'all' ? `All ${records.length}` : `${s[0].toUpperCase() + s.slice(1)} ${count(s)}`}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        {shown.length ? (
          <div className="list">
            {shown.map((r) => (
              <div key={r.student_id} className="item wrap">
                <Avatar name={r.name} />
                <div className="grow">
                  <div className="title">{r.name}</div>
                  <div className="sub">
                    {r.roll_no}
                    {r.signals?.method === 'face' && <span className="method face">Face {Math.round(r.signals.face.score * 100)}%</span>}
                    {r.signals?.method === 'manual' && <span className="method">Manual</span>}
                    {r.signals?.failed_attempts > 0 && r.status !== 'present' && <span className="method warn">⚠ {r.signals.failed_attempts} failed</span>}
                  </div>
                </div>
                {active ? (
                  <div className="seg mini">
                    {STATUSES.map((s) => (
                      <button key={s} className={`${r.status === s ? 'on' : ''} ${s}`} onClick={() => mark(r.student_id, s)}>
                        {s === 'present' ? 'P' : s === 'partial' ? 'Partial' : 'A'}
                      </button>
                    ))}
                  </div>
                ) : <span className={`badge ${r.status}`}>{r.status}</span>}
              </div>
            ))}
          </div>
        ) : <Empty icon="users" title="No students to show">{records.length ? 'Try a different filter.' : 'Enroll students in this course first.'}</Empty>}
      </div>
    </>
  );
}
