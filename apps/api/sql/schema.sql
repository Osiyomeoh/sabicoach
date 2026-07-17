CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  exam_type TEXT NOT NULL DEFAULT 'JAMB',
  target_score INTEGER NOT NULL DEFAULT 280,
  current_score INTEGER NOT NULL DEFAULT 234,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  question_text TEXT NOT NULL,
  attempt_text TEXT,
  image_url TEXT,
  diagnosis JSONB NOT NULL,
  mastery_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mistake_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 1,
  recoverable_marks INTEGER NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, label)
);

INSERT INTO students (id, display_name, exam_type, target_score, current_score)
VALUES ('00000000-0000-0000-0000-000000000001', 'Amara', 'JAMB', 280, 234)
ON CONFLICT (id) DO NOTHING;
