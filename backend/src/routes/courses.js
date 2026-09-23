const router = require('express').Router();
const pool = require('../db');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);

// returns the course if this teacher owns it, otherwise sends 404 and returns null
async function ownCourse(req, res) {
  const { rows: [c] } = await pool.query('SELECT * FROM courses WHERE id=$1 AND teacher_id=$2',
    [req.params.id, req.user.id]);
  if (!c) res.status(404).json({ error: 'Course not found' });
  return c;
}

// ---------- rooms ----------
router.get('/rooms/all', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM rooms ORDER BY name');
  res.json(rows);
});

router.post('/rooms', requireRole('teacher'), async (req, res) => {
  const { name, wifi_bssid, ble_id, lat, lng } = req.body;
  if (!name) return res.status(400).json({ error: 'Room name required' });
  try {
    const { rows: [r] } = await pool.query(
      'INSERT INTO rooms(name,wifi_bssid,ble_id,lat,lng) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [name, wifi_bssid || null, ble_id || null, lat || null, lng || null]);
    res.json(r);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Room already exists' });
    throw e;
  }
});

// ---------- student's full timetable ----------
router.get('/timetable/me', requireRole('student'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT t.*, c.name AS course_name, c.code, r.name AS room_name
     FROM timetable t JOIN courses c ON c.id=t.course_id
     JOIN enrollments e ON e.course_id=c.id AND e.student_id=$1
     LEFT JOIN rooms r ON r.id=t.room_id
     ORDER BY t.day, t.start_time`, [req.user.id]);
  res.json(rows);
});

// ---------- courses ----------
router.get('/', async (req, res) => {
  const { rows } = req.user.role === 'teacher'
    ? await pool.query(
        `SELECT c.*, (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id)::int AS student_count
         FROM courses c WHERE c.teacher_id=$1 ORDER BY c.id DESC`, [req.user.id])
    : await pool.query(
        `SELECT c.*, u.name AS teacher_name FROM courses c
         JOIN enrollments e ON e.course_id=c.id AND e.student_id=$1
         JOIN users u ON u.id=c.teacher_id ORDER BY c.name`, [req.user.id]);
  res.json(rows);
});

router.post('/', requireRole('teacher'), async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
  try {
    const { rows: [c] } = await pool.query(
      'INSERT INTO courses(name,code,teacher_id) VALUES($1,$2,$3) RETURNING *', [name, code, req.user.id]);
    res.json(c);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Course code already exists' });
    throw e;
  }
});

router.get('/:id', requireRole('teacher'), async (req, res) => {
  const course = await ownCourse(req, res); if (!course) return;
  const students = (await pool.query(
    `SELECT u.id, u.name, u.email, s.roll_no, s.branch, s.semester
     FROM enrollments e JOIN students s ON s.user_id=e.student_id JOIN users u ON u.id=s.user_id
     WHERE e.course_id=$1 ORDER BY s.roll_no`, [course.id])).rows;
  const timetable = (await pool.query(
    `SELECT t.*, r.name AS room_name FROM timetable t LEFT JOIN rooms r ON r.id=t.room_id
     WHERE t.course_id=$1 ORDER BY t.day, t.start_time`, [course.id])).rows;
  res.json({ course, students, timetable });
});

router.delete('/:id', requireRole('teacher'), async (req, res) => {
  const course = await ownCourse(req, res); if (!course) return;
  await pool.query('DELETE FROM courses WHERE id=$1', [course.id]);
  res.json({ ok: true });
});

// ---------- enrollment ----------
router.post('/:id/enroll', requireRole('teacher'), async (req, res) => {
  const course = await ownCourse(req, res); if (!course) return;
  const { rows: [s] } = await pool.query('SELECT user_id FROM students WHERE roll_no=$1', [req.body.roll_no]);
  if (!s) return res.status(404).json({ error: 'No student with that roll number' });
  await pool.query('INSERT INTO enrollments(student_id,course_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [s.user_id, course.id]);
  res.json({ ok: true });
});

router.delete('/:id/enroll/:studentId', requireRole('teacher'), async (req, res) => {
  const course = await ownCourse(req, res); if (!course) return;
  await pool.query('DELETE FROM enrollments WHERE course_id=$1 AND student_id=$2', [course.id, req.params.studentId]);
  res.json({ ok: true });
});

// ---------- timetable ----------
router.post('/:id/timetable', requireRole('teacher'), async (req, res) => {
  const course = await ownCourse(req, res); if (!course) return;
  const { day, start_time, end_time, room_id } = req.body;
  if (day === undefined || !start_time || !end_time)
    return res.status(400).json({ error: 'day, start_time and end_time required' });
  if (start_time >= end_time) return res.status(400).json({ error: 'End time must be after start time' });
  const { rows: [t] } = await pool.query(
    'INSERT INTO timetable(course_id,day,start_time,end_time,room_id) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [course.id, day, start_time, end_time, room_id || null]);
  res.json(t);
});

router.delete('/:id/timetable/:slotId', requireRole('teacher'), async (req, res) => {
  const course = await ownCourse(req, res); if (!course) return;
  await pool.query('DELETE FROM timetable WHERE id=$1 AND course_id=$2', [req.params.slotId, course.id]);
  res.json({ ok: true });
});

module.exports = router;
