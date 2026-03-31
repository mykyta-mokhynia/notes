ALTER TABLE spaces
  ADD COLUMN avatar_key INT NOT NULL DEFAULT 1;

ALTER TABLE spaces
  ADD CONSTRAINT spaces_avatar_key_range
  CHECK (avatar_key BETWEEN 1 AND 12);
