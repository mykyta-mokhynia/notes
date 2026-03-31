ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notes_created_by_user_id_idx
  ON notes (created_by_user_id);
