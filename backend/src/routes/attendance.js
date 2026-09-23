const router = require('express').Router();
const pool = require('../db');
const { auth, requireRole } = require('../middleware/auth');

router.use(auth);

async function ownSession(req, res) {
  const { rows: [s] } = await pool.query(
    `SELECT s.*, c.name AS course_name, c.code FROM attendance_sessions s
     JOIN courses c ON c.id=s.course_id WHERE s.id=$1 AND c.teacher_id=$2`, [req.params.id, req.user.id]);
  if (!s) res.status(404).json({ error: 'Session not found' });
  return s;
}

// ---------- teacher ----------
router.get('/courses/:id/sessions', requireRole('teacher'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*, COUNT(r.id) FILTER (WHERE r.status='present')::int AS present,
            COUNT(r.id)::int AS total
     FROM attendance_sessions s
     JOIN courses c ON c.id=s.course_id AND c.teacher_id=$2
     LEFT JOIN attendance_records r ON r.session_id=s.id
     WHERE s.course_id=$1 GROUP BY s.id ORDER BY s.started_at DESC`, [req.params.id, req.user.id]);
  res.json(rows);
});

router.post('/courses/:id/sessions', requireRole('teacher'), async (req, res) => {
  const { rows: [c] } = await pool.query('SELECT id FROM courses WHERE id=$1 AND teacher_id=$2',
    [req.params.id, req.user.id]);
  if (!c) return res.status(404).json({ error: 'Course not found' });
  const { rows: [active] } = await pool.query(
    "SELECT id FROM attendance_sessions WHERE course_id=$1 AND status='active'", [c.id]);
  if (active) return res.status(409).json({ error: 'A session is already active', session_id: active.id });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [s] } = await client.query(
      'INSERT INTO attendance_sessions(course_id) VALUES($1) RETURNING *', [c.id]);
    // everyone starts as absent; teacher (now) or the AI pipeline (later) upgrades them
    await client.query(
      `INSERT INTO attendance_records(session_id, student_id)
       SELECT $1, student_id FROM enrollments WHERE course_id=$2`, [s.id, c.id]);
    await client.query('COMMIT');
    res.json(s);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

router.get('/sessions/:id', requireRole('teacher'), async (req, res) => {
  const session = await ownSession(req, res); if (!session) return;
  const { rows: records } = await pool.query(
    `SELECT r.student_id, r.status, r.trust_score, r.marked_at, r.signals, u.name, s.roll_no
     FROM attendance_records r JOIN students s ON s.user_id=r.student_id JOIN users u ON u.id=s.user_id
     WHERE r.session_id=$1 ORDER BY s.roll_no`, [session.id]);
  res.json({ session, records });
});

router.post('/sessions/:id/end', requireRole('teacher'), async (req, res) => {
  const session = await ownSession(req, res); if (!session) return;
  await pool.query("UPDATE attendance_sessions SET status='ended', ended_at=now() WHERE id=$1", [session.id]);
  res.json({ ok: true });
});

// manual marking = placeholder for the AI pipeline
router.patch('/sessions/:id/records/:studentId', requireRole('teacher'), async (req, res) => {
  const session = await ownSession(req, res); if (!session) return;
  const { status } = req.body;
  if (!['present', 'absent', 'partial'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  const { rowCount } = await pool.query(
    `UPDATE attendance_records SET status=$1, marked_at=now(),
       signals = signals || '{"method":"manual"}'::jsonb
     WHERE session_id=$2 AND student_id=$3`, [status, session.id, req.params.studentId]);
  if (!rowCount) return res.status(404).json({ error: 'Record not found' });
  res.json({ ok: true });
});

// ---------- student ----------
router.get('/attendance/me', requireRole('student'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.id AS course_id, c.name, c.code,
            COUNT(s.id) FILTER (WHERE s.status='ended')::int AS total,
            COUNT(r.id) FILTER (WHERE s.status='ended' AND r.status='present')::int AS present
     FROM enrollments e JOIN courses c ON c.id=e.course_id
     LEFT JOIN attendance_sessions s ON s.course_id=c.id
     LEFT JOIN attendance_records r ON r.session_id=s.id AND r.student_id=e.student_id
     WHERE e.student_id=$1 GROUP BY c.id ORDER BY c.name`, [req.user.id]);
  const courses = rows.map((r) => ({ ...r, percentage: r.total ? Math.round((r.present / r.total) * 100) : null }));
  const total = rows.reduce((a, r) => a + r.total, 0);
  const present = rows.reduce((a, r) => a + r.present, 0);
  res.json({ overall: total ? Math.round((present / total) * 100) : null, courses });
});

// live sessions the student can check in to
router.get('/attendance/me/active', requireRole('student'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id AS session_id, s.started_at, c.name AS course_name, c.code, COALESCE(r.status, 'absent') AS status
     FROM attendance_sessions s
     JOIN courses c ON c.id = s.course_id
     JOIN enrollments e ON e.course_id = c.id AND e.student_id = $1
     LEFT JOIN attendance_records r ON r.session_id = s.id AND r.student_id = $1
     WHERE s.status = 'active' ORDER BY s.started_at DESC`, [req.user.id]);
  res.json(rows);
});

router.get('/attendance/me/history', requireRole('student'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id AS session_id, s.started_at, c.name AS course_name, r.status
     FROM attendance_records r JOIN attendance_sessions s ON s.id=r.session_id
     JOIN courses c ON c.id=s.course_id
     WHERE r.student_id=$1 AND s.status='ended' ORDER BY s.started_at DESC LIMIT 100`, [req.user.id]);
  res.json(rows);
});

module.exports = router;
