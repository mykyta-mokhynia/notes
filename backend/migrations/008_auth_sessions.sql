ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'USER',
  ADD COLUMN IF NOT EXISTS google_id TEXT,
  ADD COLUMN IF NOT EXISTS nickname TEXT,
  ADD COLUMN IF NOT EXISTS avatar_initials TEXT,
  ADD COLUMN IF NOT EXISTS avatar_color TEXT,
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE users
  ALTER COLUMN username DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL;

UPDATE users
SET
  role = 'ADMIN',
  nickname = COALESCE(nickname, NULLIF(trim(username), 'Admin')),
  avatar_initials = COALESCE(avatar_initials, 'AD'),
  avatar_color = COALESCE(avatar_color, '#5B8DEF'),
  profile_completed = true,
  updated_at = now()
WHERE password_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx
  ON users (google_id)
  WHERE google_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_role_idx
  ON users (role);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
  ON refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx
  ON refresh_tokens (expires_at);
