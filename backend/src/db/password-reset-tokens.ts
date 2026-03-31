import { query } from './index';

export interface PasswordResetTokenRecord {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

const RESET_TOKEN_COLS =
  'id, user_id, token_hash, expires_at, used_at, created_at';

export async function createPasswordResetToken(
  userId: number,
  tokenHash: string,
  expiresAt: Date
): Promise<PasswordResetTokenRecord> {
  const { rows } = await query<PasswordResetTokenRecord>(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING ${RESET_TOKEN_COLS}`,
    [userId, tokenHash, expiresAt]
  );
  return rows[0];
}

export async function getActivePasswordResetToken(
  tokenHash: string
): Promise<PasswordResetTokenRecord | null> {
  const { rows } = await query<PasswordResetTokenRecord>(
    `SELECT ${RESET_TOKEN_COLS}
     FROM password_reset_tokens
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > now()`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

export async function markPasswordResetTokenUsed(id: number): Promise<void> {
  await query(
    `UPDATE password_reset_tokens
     SET used_at = now()
     WHERE id = $1
       AND used_at IS NULL`,
    [id]
  );
}

export async function expireOpenPasswordResetTokensForUser(userId: number): Promise<void> {
  await query(
    `UPDATE password_reset_tokens
     SET used_at = now()
     WHERE user_id = $1
       AND used_at IS NULL`,
    [userId]
  );
}
