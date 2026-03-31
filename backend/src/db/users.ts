import { query } from './index';
import type { User, UserRow } from '../types';

const USER_COLS = [
  'id',
  'email',
  'password_hash',
  'role',
  'google_id',
  'nickname',
  'avatar_initials',
  'avatar_color',
  'profile_completed',
  'created_at',
  'updated_at',
].join(', ');

const AVATAR_COLORS = [
  '#5B8DEF',
  '#E86A92',
  '#F59E0B',
  '#10B981',
  '#8B5CF6',
  '#14B8A6',
  '#EF4444',
  '#6366F1',
] as const;

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role,
    google_id: row.google_id,
    nickname: row.nickname,
    avatar_initials: row.avatar_initials,
    avatar_color: row.avatar_color,
    profile_completed: row.profile_completed,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface AdminUserSummary {
  id: number;
  email: string | null;
  role: 'ADMIN' | 'USER' | 'GUEST';
  nickname: string | null;
  avatar_initials: string | null;
  avatar_color: string | null;
  profile_completed: boolean;
  has_password: boolean;
  has_google: boolean;
  created_at: Date;
  updated_at: Date;
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function buildAvatar(nickname: string): {
  initials: string;
  color: string;
} {
  const parts = nickname
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const initials = parts.length > 1
    ? `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
    : nickname.trim().slice(0, 2).toUpperCase() || 'NA';
  return {
    initials,
    color: pickRandom(AVATAR_COLORS),
  };
}

export function generateGuestProfile(): {
  nickname: string;
  avatar_initials: string;
  avatar_color: string;
} {
  const nickname = `Guest${Math.floor(1000 + Math.random() * 9000)}`;
  const avatar = buildAvatar(nickname);
  return {
    nickname,
    avatar_initials: avatar.initials,
    avatar_color: avatar.color,
  };
}

export async function countUsers(): Promise<number> {
  const { rows } = await query<{ count: string }>('SELECT count(*)::text AS count FROM users');
  return Number(rows[0]?.count ?? 0);
}

export async function countAdmins(): Promise<number> {
  const { rows } = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM users WHERE role = 'ADMIN'`
  );
  return Number(rows[0]?.count ?? 0);
}

export async function listUsersForAdmin(): Promise<AdminUserSummary[]> {
  const { rows } = await query<AdminUserSummary>(
    `SELECT
       id,
       email,
       role,
       nickname,
       avatar_initials,
       avatar_color,
       profile_completed,
       (password_hash IS NOT NULL) AS has_password,
       (google_id IS NOT NULL) AS has_google,
       created_at,
       updated_at
     FROM users
     ORDER BY created_at DESC`
  );
  return rows;
}

export async function getUserById(id: number): Promise<User | null> {
  const { rows } = await query<UserRow>(
    `SELECT ${USER_COLS} FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { rows } = await query<UserRow>(
    `SELECT ${USER_COLS} FROM users WHERE lower(email) = lower($1)`,
    [normalizeEmail(email)]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getUserByGoogleId(googleId: string): Promise<User | null> {
  const { rows } = await query<UserRow>(
    `SELECT ${USER_COLS} FROM users WHERE google_id = $1`,
    [googleId.trim()]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function createUser(params: {
  email: string;
  passwordHash: string;
  role?: 'ADMIN' | 'USER';
  nickname?: string | null;
  profileCompleted?: boolean;
}): Promise<User> {
  const { email, passwordHash, role = 'USER', nickname = null, profileCompleted = false } = params;
  const avatar = nickname ? buildAvatar(nickname) : null;
  const { rows } = await query<UserRow>(
    `INSERT INTO users (
      email,
      password_hash,
      role,
      nickname,
      avatar_initials,
      avatar_color,
      profile_completed
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING ${USER_COLS}`,
    [
      normalizeEmail(email),
      passwordHash,
      role,
      nickname,
      avatar?.initials ?? null,
      avatar?.color ?? null,
      profileCompleted,
    ]
  );
  return rowToUser(rows[0]);
}

export async function createGoogleUser(params: {
  email: string;
  googleId: string;
}): Promise<User> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (
      email,
      role,
      google_id,
      profile_completed
    ) VALUES ($1, 'USER', $2, false)
    RETURNING ${USER_COLS}`,
    [normalizeEmail(params.email), params.googleId.trim()]
  );
  return rowToUser(rows[0]);
}

export async function createGuestUser(): Promise<User> {
  const profile = generateGuestProfile();
  const { rows } = await query<UserRow>(
    `INSERT INTO users (
      role,
      nickname,
      avatar_initials,
      avatar_color,
      profile_completed
    ) VALUES ('GUEST', $1, $2, $3, true)
    RETURNING ${USER_COLS}`,
    [profile.nickname, profile.avatar_initials, profile.avatar_color]
  );
  return rowToUser(rows[0]);
}

export async function completeOnboarding(
  id: number,
  nickname: string
): Promise<User> {
  const avatar = buildAvatar(nickname);
  const { rows } = await query<UserRow>(
    `UPDATE users
     SET
       nickname = $2,
       avatar_initials = $3,
       avatar_color = $4,
       profile_completed = true,
       updated_at = now()
     WHERE id = $1
     RETURNING ${USER_COLS}`,
    [id, nickname.trim(), avatar.initials, avatar.color]
  );
  return rowToUser(rows[0]);
}

export async function updateUserPassword(
  id: number,
  passwordHash: string
): Promise<User | null> {
  const { rows } = await query<UserRow>(
    `UPDATE users
     SET
       password_hash = $2,
       updated_at = now()
     WHERE id = $1
     RETURNING ${USER_COLS}`,
    [id, passwordHash]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function linkGoogleAccount(
  id: number,
  googleId: string
): Promise<User | null> {
  const { rows } = await query<UserRow>(
    `UPDATE users
     SET
       google_id = $2,
       updated_at = now()
     WHERE id = $1
     RETURNING ${USER_COLS}`,
    [id, googleId.trim()]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function unlinkGoogleAccount(id: number): Promise<User | null> {
  const { rows } = await query<UserRow>(
    `UPDATE users
     SET
       google_id = NULL,
       updated_at = now()
     WHERE id = $1
     RETURNING ${USER_COLS}`,
    [id]
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function upsertAdminUser(params: {
  email: string;
  passwordHash: string;
  nickname: string;
}): Promise<User> {
  const email = normalizeEmail(params.email);
  const avatar = buildAvatar(params.nickname);
  const existing = await getUserByEmail(email);
  const { rows } = existing
    ? await query<UserRow>(
        `UPDATE users
         SET
           password_hash = $2,
           role = 'ADMIN',
           nickname = $3,
           avatar_initials = $4,
           avatar_color = $5,
           profile_completed = true,
           updated_at = now()
         WHERE id = $1
         RETURNING ${USER_COLS}`,
        [
          existing.id,
          params.passwordHash,
          params.nickname.trim(),
          avatar.initials,
          avatar.color,
        ]
      )
    : await query<UserRow>(
        `INSERT INTO users (
          email,
          password_hash,
          role,
          nickname,
          avatar_initials,
          avatar_color,
          profile_completed
        ) VALUES ($1, $2, 'ADMIN', $3, $4, $5, true)
        RETURNING ${USER_COLS}`,
        [email, params.passwordHash, params.nickname.trim(), avatar.initials, avatar.color]
      );
  return rowToUser(rows[0]);
}
