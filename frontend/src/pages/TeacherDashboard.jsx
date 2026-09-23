import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../components/Toast';
import { Icon, Spinner, Empty, colorFor } from '../components/ui';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const [courses, setCourses] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [course, setCourse] = useState({ name: '', code: '' });
  const [room, setRoom] = useState('');

  const load = async () => {
    setCourses(await api('/courses'));
    setRooms(await api('/courses/rooms/all'));
  };
  useEffect(() => { load().catch((e) => toast(e.message, 'err')); }, []);

  const addCourse = async (ev) => {
    ev.preventDefault();
    try { await api('/courses', { method: 'POST', body: course }); setCourse({ name: '', code: '' }); toast('Course created'); load(); }
    catch (e) { toast(e.message, 'err'); }
  };
  const addRoom = async (ev) => {
    ev.preventDefault();
    try { await api('/courses/rooms', { method: 'POST', body: { name: room } }); setRoom(''); toast('Room added'); load(); }
    catch (e) { toast(e.message, 'err'); }
  };

  if (!courses) return <Spinner />;
  const totalStudents = courses.reduce((a, c) => a + c.student_count, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Hi, {user.name.split(' ')[0]} 👋</h1>
          <p className="muted">Manage your classes and take attendance.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span className="stat-icon"><Icon name="book" /></span><b>{courses.length}</b><small>Courses</small></div>
        <div className="stat"><span className="stat-icon"><Icon name="users" /></span><b>{totalStudents}</b><small>Enrollments</small></div>
        <div className="stat"><span className="stat-icon"><Icon name="building" /></span><b>{rooms.length}</b><small>Rooms</small></div>
      </div>

      <h2 className="section">Your courses</h2>
      {courses.length ? (
        <div className="grid-cards">
          {courses.map((c) => (
            <Link key={c.id} to={`/course/${c.id}`} className="course-card" style={{ '--accent': colorFor(c.code) }}>
              <span className="badge">{c.code}</span>
              <h3>{c.name}</h3>
              <p className="muted"><Icon name="users" size={15} /> {c.student_count} students</p>
              <span className="go"><Icon name="chevron" /></span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card"><Empty icon="book" title="No courses yet">Create your first course below.</Empty></div>
      )}

      <div className="cols">
        <form className="card" onSubmit={addCourse}>
          <h3>New course</h3>
          <label className="field"><span>Course name</span>
            <input placeholder="Database Management Systems" value={course.name} onChange={(e) => setCourse({ ...course, name: e.target.value })} required /></label>
          <label className="field"><span>Course code</span>
            <input placeholder="CS301" value={course.code} onChange={(e) => setCourse({ ...course, code: e.target.value })} required /></label>
          <button className="btn block"><Icon name="plus" /> Create course</button>
        </form>

        <form className="card" onSubmit={addRoom}>
          <h3>Rooms</h3>
          <div className="chips mb">
            {rooms.map((r) => <span key={r.id} className="chip">{r.name}</span>)}
            {!rooms.length && <span className="muted">No rooms yet</span>}
          </div>
          <label className="field"><span>Room name</span>
            <input placeholder="CSE-204" value={room} onChange={(e) => setRoom(e.target.value)} required /></label>
          <button className="btn soft block"><Icon name="plus" /> Add room</button>
        </form>
      </div>
    </>
  );
}
