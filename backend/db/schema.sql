-- SmartAttend schema (Phase 1, with later phases in mind)
DROP TABLE IF EXISTS checkpoints, attendance_records, attendance_sessions, face_embeddings,
  timetable, enrollments, courses, rooms, teachers, students, users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','teacher')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE students (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  roll_no TEXT UNIQUE NOT NULL,
  branch TEXT,
  semester INT
);

CREATE TABLE teachers (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  department TEXT
);

CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,          -- e.g. CSE-204
  wifi_bssid TEXT,                    -- Phase 5
  ble_id TEXT,                        -- Phase 5
  lat DOUBLE PRECISION,               -- Phase 4
  lng DOUBLE PRECISION
);

CREATE TABLE courses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  teacher_id INT NOT NULL REFERENCES teachers(user_id) ON DELETE CASCADE
);

CREATE TABLE enrollments (
  student_id INT REFERENCES students(user_id) ON DELETE CASCADE,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE,
  PRIMARY KEY (student_id, course_id)
);

CREATE TABLE timetable (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  day SMALLINT NOT NULL CHECK (day BETWEEN 0 AND 6),  -- 0 = Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_id INT REFERENCES rooms(id) ON DELETE SET NULL
);

CREATE TABLE attendance_sessions (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended'))
);

CREATE TABLE attendance_records (
  id SERIAL PRIMARY KEY,
  session_id INT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'absent' CHECK (status IN ('present','absent','partial')),
  trust_score NUMERIC(5,2),           -- Phase 6
  signals JSONB DEFAULT '{}'::jsonb,  -- face / liveness / gps / room results
  marked_at TIMESTAMPTZ,
  UNIQUE (session_id, student_id)
);

CREATE TABLE checkpoints (            -- Phase 7
  id SERIAL PRIMARY KEY,
  record_id INT NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ DEFAULT now(),
  passed BOOLEAN NOT NULL
);

CREATE TABLE face_embeddings (        -- Phase 2 (stored as JSON array)
  student_id INT PRIMARY KEY REFERENCES students(user_id) ON DELETE CASCADE,
  embedding JSONB NOT NULL
);
