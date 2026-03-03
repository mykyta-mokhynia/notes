-- Add visibility to spaces (same enum as notes)
ALTER TABLE spaces
  ADD COLUMN visibility note_visibility NOT NULL DEFAULT 'PRIVATE';
