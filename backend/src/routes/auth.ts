import { Router, Request, Response } from 'express';
import * as usersDb from '../db/users';
import { hashPassword, verifyPassword } from '../auth/password';
import * as refreshTokensDb from '../db/refresh-tokens';
import * as passwordResetTokensDb from '../db/password-reset-tokens';
import { config } from '../config';
import { verifyGoogleIdToken } from '../auth/google';
import {
  buildPasswordResetUrl,
  canSendPasswordResetEmail,
  sendPasswordResetEmail,
} from '../mail/password-reset';
import {
  generateRefreshToken,
  hashOpaqueToken,
  issueAccessToken,
} from '../auth/token';
import { requireAuthenticated } from '../auth/middleware';
import type { AuthenticatedUser, User } from '../types';

const router = Router();
type AuthRequest = Request & { auth?: AuthenticatedUser };
const PROFILE_KEY_RE = /^[A-Za-z0-9_-]{1,120}$/;

function presentUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    nickname: user.nickname,
    avatar_initials: user.avatar_initials,
    avatar_color: user.avatar_color,
    profile_completed: user.profile_completed,
    has_password: !!user.password_hash,
    has_google: !!user.google_id,
  };
}

function isSecureRequest(req: Request): boolean {
  return req.secure || req.header('x-forwarded-proto') === 'https';
}

function refreshExpiresAt(): Date {
  return new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
}

function passwordResetExpiresAt(): Date {
  return new Date(Date.now() + config.passwordResetTtlMinutes * 60 * 1000);
}

function refreshCookieName(profileKey: string): string {
  return `${config.refreshTokenCookieName}_${profileKey}`;
}

function setRefreshCookie(
  req: Request,
  res: Response,
  profileKey: string,
  token: string,
  expiresAt: Date
): void {
  res.cookie(refreshCookieName(profileKey), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    expires: expiresAt,
    path: '/api/auth',
  });
}

function clearRefreshCookie(req: Request, res: Response, profileKey: string): void {
  res.clearCookie(refreshCookieName(profileKey), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    path: '/api/auth',
  });
}

function parseCookies(req: Request): Map<string, string> {
  const header = req.header('cookie');
  if (!header) return new Map();
  const cookies = header.split(';').map((part) => part.trim());
  const parsed = new Map<string, string>();
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split('=');
    if (name) {
      parsed.set(name, decodeURIComponent(valueParts.join('=')));
    }
  }
  return parsed;
}

function listProfileCookies(req: Request): Array<{ profileKey: string; token: string }> {
  const prefix = `${config.refreshTokenCookieName}_`;
  return [...parseCookies(req).entries()]
    .filter(([cookieName, token]) => cookieName.startsWith(prefix) && !!token)
    .map(([cookieName, token]) => ({
      profileKey: cookieName.slice(prefix.length),
      token,
    }))
    .filter(({ profileKey }) => PROFILE_KEY_RE.test(profileKey));
}

function readProfileCookie(req: Request, profileKey: string): string | null {
  return parseCookies(req).get(refreshCookieName(profileKey)) ?? null;
}

function readProfileKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return 'default';
  }
  const trimmed = value.trim();
  return PROFILE_KEY_RE.test(trimmed) ? trimmed : null;
}

function requireProfileKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return PROFILE_KEY_RE.test(trimmed) ? trimmed : null;
}

function sessionResponse(user: User, profileKey: string) {
  return {
    access_token: issueAccessToken(user),
    user: presentUser(user),
    profile_key: profileKey,
  };
}

function presentBrowserProfile(user: User, profileKey: string) {
  return {
    profile_key: profileKey,
    ...presentUser(user),
  };
}

async function issueSession(
  req: Request,
  res: Response,
  user: User,
  profileKey: string
): Promise<void> {
  const refreshToken = generateRefreshToken();
  const refreshHash = hashOpaqueToken(refreshToken);
  const expiresAt = refreshExpiresAt();
  await refreshTokensDb.revokeRefreshTokensByProfileKey(profileKey);
  await refreshTokensDb.createRefreshToken(user.id, refreshHash, expiresAt, profileKey);
  setRefreshCookie(req, res, profileKey, refreshToken, expiresAt);
  res.json(sessionResponse(user, profileKey));
}

function maybeExposeResetPreview(token: string): {
  reset_token?: string;
  reset_url?: string;
} {
  if (config.nodeEnv === 'production') {
    return {};
  }
  const resetUrl = buildPasswordResetUrl(token);
  return {
    reset_token: token,
    reset_url: resetUrl,
  };
}

router.get('/status', async (_req: Request, res: Response) => {
  const has_admin = (await usersDb.countAdmins()) > 0;
  res.json({
    has_admin,
    google_auth_enabled: !!config.googleClientId.trim(),
  });
});

router.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const profileKey = readProfileKey(req.body?.profile_key);
  if (!profileKey) {
    res.status(400).json({ error: 'PROFILE_KEY_INVALID' });
    return;
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'EMAIL_INVALID' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
    return;
  }

  const existing = await usersDb.getUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'EMAIL_ALREADY_EXISTS' });
    return;
  }

  const user = await usersDb.createUser({
    email,
    passwordHash: await hashPassword(password),
  });
  await issueSession(req, res, user, profileKey);
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const profileKey = readProfileKey(req.body?.profile_key);
  if (!profileKey) {
    res.status(400).json({ error: 'PROFILE_KEY_INVALID' });
    return;
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'INVALID_CREDENTIALS' });
    return;
  }

  const user = await usersDb.getUserByEmail(email);
  if (
    !user ||
    !user.password_hash ||
    !(await verifyPassword(password, user.password_hash))
  ) {
    res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    return;
  }

  await issueSession(req, res, user, profileKey);
});

router.post('/guest', async (req: Request, res: Response) => {
  const profileKey = readProfileKey(req.body?.profile_key);
  if (!profileKey) {
    res.status(400).json({ error: 'PROFILE_KEY_INVALID' });
    return;
  }
  const guest = await usersDb.createGuestUser();
  await issueSession(req, res, guest, profileKey);
});

router.post('/google', async (req: Request, res: Response) => {
  const { credential } = req.body;
  const profileKey = readProfileKey(req.body?.profile_key);
  if (!profileKey) {
    res.status(400).json({ error: 'PROFILE_KEY_INVALID' });
    return;
  }
  if (typeof credential !== 'string' || !credential.trim()) {
    res.status(400).json({ error: 'GOOGLE_CREDENTIAL_REQUIRED' });
    return;
  }

  try {
    const identity = await verifyGoogleIdToken(credential.trim());
    let user = await usersDb.getUserByGoogleId(identity.sub);

    if (!user) {
      const byEmail = await usersDb.getUserByEmail(identity.email);
      if (byEmail) {
        if (byEmail.google_id && byEmail.google_id !== identity.sub) {
          res.status(409).json({ error: 'GOOGLE_ACCOUNT_CONFLICT' });
          return;
        }
        user = byEmail.google_id
          ? byEmail
          : await usersDb.linkGoogleAccount(byEmail.id, identity.sub);
      }
    }

    if (!user) {
      user = await usersDb.createGoogleUser({
        email: identity.email,
        googleId: identity.sub,
      });
    }

    await issueSession(req, res, user, profileKey);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'GOOGLE_AUTH_FAILED';
    const status =
      message === 'GOOGLE_AUTH_DISABLED' ? 503 : 401;
    res.status(status).json({ error: message });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  const profileKey = readProfileKey(req.body?.profile_key);
  if (!profileKey) {
    res.status(400).json({ error: 'PROFILE_KEY_INVALID' });
    return;
  }
  const refreshToken = readProfileCookie(req, profileKey);
  if (!refreshToken) {
    res.status(401).json({ error: 'REFRESH_REQUIRED' });
    return;
  }

  const record = await refreshTokensDb.getActiveRefreshToken(
    hashOpaqueToken(refreshToken)
  );
  if (!record) {
    clearRefreshCookie(req, res, profileKey);
    res.status(401).json({ error: 'REFRESH_INVALID' });
    return;
  }
  if (record.profile_key !== profileKey) {
    await refreshTokensDb.revokeRefreshTokenById(record.id);
    clearRefreshCookie(req, res, profileKey);
    res.status(401).json({ error: 'REFRESH_INVALID' });
    return;
  }

  const user = await usersDb.getUserById(record.user_id);
  if (!user) {
    await refreshTokensDb.revokeRefreshTokenById(record.id);
    clearRefreshCookie(req, res, profileKey);
    res.status(401).json({ error: 'REFRESH_INVALID' });
    return;
  }

  await refreshTokensDb.revokeRefreshTokenById(record.id);
  await issueSession(req, res, user, profileKey);
});

router.post('/logout', async (req: Request, res: Response) => {
  const profileKey = readProfileKey(req.body?.profile_key);
  if (!profileKey) {
    res.status(400).json({ error: 'PROFILE_KEY_INVALID' });
    return;
  }
  const refreshToken = readProfileCookie(req, profileKey);
  if (refreshToken) {
    await refreshTokensDb.revokeRefreshTokenByHash(hashOpaqueToken(refreshToken));
  }
  clearRefreshCookie(req, res, profileKey);
  res.status(204).send();
});

router.get('/profiles', async (req: Request, res: Response) => {
  const profileCookies = listProfileCookies(req);
  if (!profileCookies.length) {
    res.json({ profiles: [] });
    return;
  }

  const tokenHashes = profileCookies.map(({ token }) => hashOpaqueToken(token));
  const records = await refreshTokensDb.getActiveRefreshTokens(tokenHashes);
  const recordByHash = new Map(records.map((record) => [record.token_hash, record]));
  const profiles: ReturnType<typeof presentBrowserProfile>[] = [];

  for (const { profileKey, token } of profileCookies) {
    const record = recordByHash.get(hashOpaqueToken(token));
    if (!record || record.profile_key !== profileKey) {
      clearRefreshCookie(req, res, profileKey);
      continue;
    }

    const user = await usersDb.getUserById(record.user_id);
    if (!user) {
      await refreshTokensDb.revokeRefreshTokenById(record.id);
      clearRefreshCookie(req, res, profileKey);
      continue;
    }

    if (user.role === 'GUEST') {
      continue;
    }

    profiles.push(presentBrowserProfile(user, profileKey));
  }

  res.json({ profiles });
});

router.delete('/profiles/:profileKey', async (req: Request, res: Response) => {
  const profileKey = requireProfileKey(req.params.profileKey);
  if (!profileKey) {
    res.status(400).json({ error: 'PROFILE_KEY_INVALID' });
    return;
  }

  const refreshToken = readProfileCookie(req, profileKey);
  if (refreshToken) {
    await refreshTokensDb.revokeRefreshTokenByHash(hashOpaqueToken(refreshToken));
  }
  clearRefreshCookie(req, res, profileKey);
  res.status(204).send();
});

router.delete('/profiles', async (req: Request, res: Response) => {
  const profileCookies = listProfileCookies(req);
  await refreshTokensDb.revokeRefreshTokensByHashes(
    profileCookies.map(({ token }) => hashOpaqueToken(token))
  );
  for (const { profileKey } of profileCookies) {
    clearRefreshCookie(req, res, profileKey);
  }
  res.status(204).send();
});

router.get('/me', requireAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const user = await usersDb.getUserById(authReq.auth!.id);
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  res.json(presentUser(user));
});

router.patch('/me/profile', requireAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (authReq.auth!.role === 'GUEST') {
    res.status(403).json({ error: 'PROFILE_UPDATE_FORBIDDEN' });
    return;
  }

  const { nickname } = req.body;
  if (typeof nickname !== 'string' || nickname.trim().length < 2) {
    res.status(400).json({ error: 'NICKNAME_TOO_SHORT' });
    return;
  }

  const updated = await usersDb.completeOnboarding(authReq.auth!.id, nickname.trim());
  res.json(sessionResponse(updated, readProfileKey(req.body?.profile_key) ?? 'default'));
});

router.post('/me/password', requireAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (authReq.auth!.role === 'GUEST') {
    res.status(403).json({ error: 'PASSWORD_UPDATE_FORBIDDEN' });
    return;
  }

  const { current_password, new_password } = req.body;
  if (typeof new_password !== 'string' || new_password.length < 8) {
    res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
    return;
  }

  const user = await usersDb.getUserById(authReq.auth!.id);
  if (!user) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  if (user.password_hash) {
    if (typeof current_password !== 'string') {
      res.status(400).json({ error: 'CURRENT_PASSWORD_REQUIRED' });
      return;
    }
    const valid = await verifyPassword(current_password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'CURRENT_PASSWORD_INVALID' });
      return;
    }
  }

  const updated = await usersDb.updateUserPassword(
    user.id,
    await hashPassword(new_password)
  );
  if (!updated) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  await refreshTokensDb.revokeAllRefreshTokensForUser(updated.id);
  await issueSession(req, res, updated, readProfileKey(req.body?.profile_key) ?? 'default');
});

router.post('/me/link-google', requireAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (authReq.auth!.role === 'GUEST') {
    res.status(403).json({ error: 'GOOGLE_LINK_FORBIDDEN' });
    return;
  }

  const { credential } = req.body;
  if (typeof credential !== 'string' || !credential.trim()) {
    res.status(400).json({ error: 'GOOGLE_CREDENTIAL_REQUIRED' });
    return;
  }

  try {
    const identity = await verifyGoogleIdToken(credential.trim());
    const currentUser = await usersDb.getUserById(authReq.auth!.id);
    if (!currentUser || !currentUser.email) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (currentUser.email.toLowerCase() !== identity.email.toLowerCase()) {
      res.status(409).json({ error: 'GOOGLE_EMAIL_MISMATCH' });
      return;
    }

    const linkedUser = await usersDb.getUserByGoogleId(identity.sub);
    if (linkedUser && linkedUser.id !== currentUser.id) {
      res.status(409).json({ error: 'GOOGLE_ACCOUNT_CONFLICT' });
      return;
    }

    const updated = await usersDb.linkGoogleAccount(currentUser.id, identity.sub);
    if (!updated) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    res.json(sessionResponse(updated, readProfileKey(req.body?.profile_key) ?? 'default'));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'GOOGLE_AUTH_FAILED';
    const status = message === 'GOOGLE_AUTH_DISABLED' ? 503 : 401;
    res.status(status).json({ error: message });
  }
});

router.delete('/me/link-google', requireAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (authReq.auth!.role === 'GUEST') {
    res.status(403).json({ error: 'GOOGLE_UNLINK_FORBIDDEN' });
    return;
  }

  const currentUser = await usersDb.getUserById(authReq.auth!.id);
  if (!currentUser) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }
  if (!currentUser.google_id) {
    res.status(400).json({ error: 'GOOGLE_NOT_LINKED' });
    return;
  }
  if (!currentUser.password_hash) {
    res.status(400).json({ error: 'PASSWORD_REQUIRED_TO_UNLINK_GOOGLE' });
    return;
  }

  const updated = await usersDb.unlinkGoogleAccount(currentUser.id);
  if (!updated) {
    res.status(404).json({ error: 'NOT_FOUND' });
    return;
  }

  res.json(sessionResponse(updated, readProfileKey(req.body?.profile_key) ?? 'default'));
});

router.patch('/onboarding', requireAuthenticated, async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (authReq.auth!.role === 'GUEST') {
    res.status(403).json({ error: 'ONBOARDING_NOT_ALLOWED' });
    return;
  }

  const { nickname } = req.body;
  if (typeof nickname !== 'string' || nickname.trim().length < 2) {
    res.status(400).json({ error: 'NICKNAME_TOO_SHORT' });
    return;
  }

  const updated = await usersDb.completeOnboarding(authReq.auth!.id, nickname.trim());
  res.json(sessionResponse(updated, readProfileKey(req.body?.profile_key) ?? 'default'));
});

router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (typeof email !== 'string' || !email.includes('@')) {
    res.status(204).send();
    return;
  }

  const user = await usersDb.getUserByEmail(email);
  if (!user || user.role === 'GUEST' || !user.email) {
    res.status(204).send();
    return;
  }

  const token = generateRefreshToken();
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = passwordResetExpiresAt();

  await passwordResetTokensDb.expireOpenPasswordResetTokensForUser(user.id);
  await passwordResetTokensDb.createPasswordResetToken(user.id, tokenHash, expiresAt);

  const preview = maybeExposeResetPreview(token);
  const mailConfigured = canSendPasswordResetEmail();

  try {
    if (mailConfigured) {
      await sendPasswordResetEmail(user.email, token);
    } else if (preview.reset_url) {
      console.log(`Password reset URL for ${user.email}: ${preview.reset_url}`);
    } else {
      console.error('Password reset email requested without SMTP configuration');
      res.status(503).json({ error: 'PASSWORD_RESET_UNAVAILABLE' });
      return;
    }
  } catch (error) {
    console.error('Failed to send password reset email', error);
    res.status(503).json({ error: 'PASSWORD_RESET_UNAVAILABLE' });
    return;
  }

  if (config.nodeEnv === 'production') {
    res.status(204).send();
    return;
  }

  res.json({
    ok: true,
    email_sent: mailConfigured,
    ...preview,
  });
});

router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, password } = req.body;
  if (typeof token !== 'string' || !token.trim()) {
    res.status(400).json({ error: 'RESET_TOKEN_REQUIRED' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'PASSWORD_TOO_SHORT' });
    return;
  }

  const record = await passwordResetTokensDb.getActivePasswordResetToken(
    hashOpaqueToken(token.trim())
  );
  if (!record) {
    res.status(400).json({ error: 'RESET_TOKEN_INVALID' });
    return;
  }

  const user = await usersDb.updateUserPassword(
    record.user_id,
    await hashPassword(password)
  );
  if (!user) {
    await passwordResetTokensDb.markPasswordResetTokenUsed(record.id);
    res.status(400).json({ error: 'RESET_TOKEN_INVALID' });
    return;
  }

  await passwordResetTokensDb.markPasswordResetTokenUsed(record.id);
  await passwordResetTokensDb.expireOpenPasswordResetTokensForUser(user.id);
  await refreshTokensDb.revokeAllRefreshTokensForUser(user.id);
  await issueSession(req, res, user, readProfileKey(req.body?.profile_key) ?? 'default');
});

export default router;
