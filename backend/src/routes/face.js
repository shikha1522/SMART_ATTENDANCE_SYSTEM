const router = require('express').Router();
const pool = require('../db');
const { auth, requireRole } = require('../middleware/auth');

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// ---- talk to the Python service ------------------------------------------
async function ml(path, body) {
  let res;
  try {
    res = await fetch(ML_URL + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw Object.assign(new Error('Face service is not running. Start ml-service first.'), { status: 503 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || 'Face service error'), { status: res.status === 422 ? 422 : 502 });
  return data;
}

const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const norm = (a) => Math.sqrt(dot(a, a)) || 1;
const cosine = (a, b) => dot(a, b) / (norm(a) * norm(b));

const fail = (res, e) => {
  if (!e.status) console.error(e);
  res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error' });
};

// ---- face registration ----------------------------------------------------
router.get('/face/status', auth, requireRole('student'), async (req, res) => {
  const { rows: [r] } = await pool.query(
    'SELECT jsonb_array_length(embedding) AS n FROM face_embeddings WHERE student_id=$1', [req.user.id]);
  res.json({ registered: !!r, photos: r ? r.n : 0 });
});

router.post('/face/register', auth, requireRole('student'), async (req, res) => {
  const { images } = req.body;
  if (!Array.isArray(images) || images.length < 3 || images.length > 8)
    return res.status(400).json({ error: 'Send between 3 and 8 photos' });
  try {
    const embs = [];
    for (let i = 0; i < images.length; i++) {
      try {
        embs.push((await ml('/embed', { image: images[i] })).embedding);
      } catch (e) {
        if (e.status === 422) e.message = `Photo ${i + 1}: ${e.message}`;
        throw e;
      }
    }
    // all photos must be of the same person: compare each photo with the average of the OTHERS
    const bad = embs.findIndex((e, i) => {
      const others = embs.filter((_, j) => j !== i);
      const mean = e.map((_, k) => others.reduce((sum, o) => sum + o[k], 0) / others.length);
      return cosine(e, mean) < 0.3;
    });
    if (bad >= 0) {
      return res.status(422).json({ error: `Photo ${bad + 1} does not look like the same person as the others. Please retake.` });
    }
    await pool.query(
      `INSERT INTO face_embeddings(student_id, embedding) VALUES($1, $2::jsonb)
       ON CONFLICT (student_id) DO UPDATE SET embedding = EXCLUDED.embedding`,
      [req.user.id, JSON.stringify(embs)]);
    res.json({ ok: true, photos: embs.length });
  } catch (e) { fail(res, e); }
});

router.delete('/face', auth, requireRole('student'), async (req, res) => {
  await pool.query('DELETE FROM face_embeddings WHERE student_id=$1', [req.user.id]);
  res.json({ ok: true });
});

// ---- student check-in (face verification) -----------------------------------
router.post('/sessions/:id/checkin', auth, requireRole('student'), async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No photo received' });
  try {
    const { rows: [s] } = await pool.query(
      `SELECT s.id, s.status FROM attendance_sessions s
       JOIN enrollments e ON e.course_id = s.course_id AND e.student_id = $2
       WHERE s.id = $1`, [req.params.id, req.user.id]);
    if (!s) return res.status(404).json({ error: 'You are not enrolled in this class' });
    if (s.status !== 'active') return res.status(409).json({ error: 'This session has ended' });

    // students who were enrolled after the session started still get a record
    await pool.query(
      'INSERT INTO attendance_records(session_id, student_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [s.id, req.user.id]);
    const { rows: [rec] } = await pool.query(
      'SELECT status, signals FROM attendance_records WHERE session_id=$1 AND student_id=$2', [s.id, req.user.id]);
    if (rec.status === 'present') return res.json({ matched: true, already: true });

    const { rows: [fe] } = await pool.query('SELECT embedding FROM face_embeddings WHERE student_id=$1', [req.user.id]);
    if (!fe) return res.status(400).json({ error: 'Register your face first', needs_registration: true });

    const r = await ml('/verify', { image, embeddings: fe.embedding });

    if (r.match) {
      const signals = { method: 'face', face: { score: r.score, threshold: r.threshold } };
      await pool.query(
        `UPDATE attendance_records SET status='present', marked_at=now(), signals = signals || $3::jsonb
         WHERE session_id=$1 AND student_id=$2`, [s.id, req.user.id, JSON.stringify(signals)]);
      return res.json({ matched: true, score: r.score });
    }

    const failed = (rec.signals?.failed_attempts || 0) + 1;
    await pool.query(
      `UPDATE attendance_records SET signals = signals || $3::jsonb WHERE session_id=$1 AND student_id=$2`,
      [s.id, req.user.id, JSON.stringify({ failed_attempts: failed, last_failed_score: r.score })]);
    res.json({ matched: false, score: r.score, threshold: r.threshold, failed_attempts: failed });
  } catch (e) { fail(res, e); }
});

module.exports = router;
