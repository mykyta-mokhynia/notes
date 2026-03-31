CREATE TABLE IF NOT EXISTS note_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('USER', 'GUEST')),
  author_role TEXT NOT NULL CHECK (author_role IN ('ADMIN', 'USER', 'GUEST')),
  nickname TEXT NOT NULL,
  avatar_initials TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS note_comments_note_id_created_at_idx
  ON note_comments (note_id, created_at);

CREATE INDEX IF NOT EXISTS note_comments_author_id_idx
  ON note_comments (author_id);
