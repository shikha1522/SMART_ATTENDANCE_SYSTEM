const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { auth } = require('../middleware/auth');

const sign = (u) =>
  jwt.sign({ id: u.id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
  const { name, email, password, role, roll_no, branch, semester, department } = req.body;
  if (!name || !email || !password || !['student', 'teacher'].includes(role))
    return res.status(400).json({ error: 'Missing or invalid fields' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (role === 'student' && !roll_no) return res.status(400).json({ error: 'Roll number is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = await bcrypt.hash(password, 10);
    const { rows: [user] } = await client.query(
      'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role',
      [name, email.toLowerCase(), hash, role]
    );
    if (role === 'student')
      await client.query('INSERT INTO students(user_id,roll_no,branch,semester) VALUES($1,$2,$3,$4)',
        [user.id, roll_no, branch || null, semester || null]);
    else
      await client.query('INSERT INTO teachers(user_id,department) VALUES($1,$2)', [user.id, department || null]);
    await client.query('COMMIT');
    res.json({ token: sign(user), user });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'Email or roll number already registered' });
    throw e;
  } finally {
    client.release();
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows: [u] } = await pool.query('SELECT * FROM users WHERE email=$1', [(email || '').toLowerCase()]);
  if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  const user = { id: u.id, name: u.name, email: u.email, role: u.role };
  res.json({ token: sign(user), user });
});

router.get('/me', auth, async (req, res) => {
  const { rows: [u] } = await pool.query('SELECT id,name,email,role FROM users WHERE id=$1', [req.user.id]);
  if (u.role === 'student') {
    const { rows: [s] } = await pool.query('SELECT roll_no,branch,semester FROM students WHERE user_id=$1', [u.id]);
    return res.json({ ...u, ...s });
  }
  const { rows: [t] } = await pool.query('SELECT department FROM teachers WHERE user_id=$1', [u.id]);
  res.json({ ...u, ...t });
});

module.exports = router;
