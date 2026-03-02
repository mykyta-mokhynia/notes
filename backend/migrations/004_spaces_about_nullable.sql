-- Allow space without an about note (no auto-creation on space create)
ALTER TABLE spaces
  ALTER COLUMN about_note_id DROP NOT NULL;
