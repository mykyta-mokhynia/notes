import { query } from './index';

export interface RefreshTokenRecord {
  id: number;
  user_id: number;
  token_hash: string;
  profile_key: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

const REFRESH_TOKEN_COLS =
  'id, user_id, token_hash, profile_key, expires_at, revoked_at, created_at';

export async function createRefreshToken(
  userId: number,
  tokenHash: string,
  expiresAt: Date,
  profileKey: string
): Promise<RefreshTokenRecord> {
  const { rows } = await query<RefreshTokenRecord>(
    `INSERT INTO refresh_tokens (user_id, token_hash, profile_key, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING ${REFRESH_TOKEN_COLS}`,
    [userId, tokenHash, profileKey, expiresAt]
  );
  return rows[0];
}

export async function getActiveRefreshToken(
  tokenHash: string
): Promise<RefreshTokenRecord | null> {
  const { rows } = await query<RefreshTokenRecord>(
    `SELECT ${REFRESH_TOKEN_COLS}
     FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > now()`,
    [tokenHash]
  );
  return rows[0] ?? null;
}

export async function getActiveRefreshTokens(
  tokenHashes: string[]
): Promise<RefreshTokenRecord[]> {
  if (!tokenHashes.length) {
    return [];
  }
  const { rows } = await query<RefreshTokenRecord>(
    `SELECT ${REFRESH_TOKEN_COLS}
     FROM refresh_tokens
     WHERE token_hash = ANY($1::text[])
       AND revoked_at IS NULL
       AND expires_at > now()`,
    [tokenHashes]
  );
  return rows;
}

export async function revokeRefreshTokenById(id: number): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE id = $1
       AND revoked_at IS NULL`,
    [id]
  );
}

export async function revokeRefreshTokenByHash(tokenHash: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE token_hash = $1
       AND revoked_at IS NULL`,
    [tokenHash]
  );
}

export async function revokeRefreshTokensByHashes(tokenHashes: string[]): Promise<void> {
  if (!tokenHashes.length) {
    return;
  }
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE token_hash = ANY($1::text[])
       AND revoked_at IS NULL`,
    [tokenHashes]
  );
}

export async function revokeRefreshTokensByProfileKey(profileKey: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE profile_key = $1
       AND revoked_at IS NULL`,
    [profileKey]
  );
}

export async function revokeAllRefreshTokensForUser(userId: number): Promise<void> {
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId]
  );
}
