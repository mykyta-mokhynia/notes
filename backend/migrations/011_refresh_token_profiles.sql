ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS profile_key TEXT;

UPDATE refresh_tokens
SET profile_key = 'default'
WHERE profile_key IS NULL;

ALTER TABLE refresh_tokens
  ALTER COLUMN profile_key SET NOT NULL;

CREATE INDEX IF NOT EXISTS refresh_tokens_profile_key_idx
  ON refresh_tokens (profile_key);
