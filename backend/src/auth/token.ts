import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { config } from '../config';
import type { UserRole } from '../types';

interface AccessTokenPayload {
  sub: number;
  role: UserRole;
  type: 'access';
  exp: number;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf-8');
}

function sign(payload: string): string {
  return createHmac('sha256', config.authTokenSecret)
    .update(payload)
    .digest('base64url');
}

export function issueAccessToken(user: { id: number; role: UserRole }): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    role: user.role,
    type: 'access',
    exp: Math.floor(Date.now() / 1000) + config.accessTokenTtlMinutes * 60,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('INVALID_TOKEN');
  }

  const expected = sign(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    throw new Error('INVALID_TOKEN');
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AccessTokenPayload;
  if (
    typeof payload.sub !== 'number' ||
    (payload.role !== 'ADMIN' && payload.role !== 'USER' && payload.role !== 'GUEST') ||
    payload.type !== 'access' ||
    typeof payload.exp !== 'number'
  ) {
    throw new Error('INVALID_TOKEN');
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('TOKEN_EXPIRED');
  }

  return payload;
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashOpaqueToken(token: string): string {
  return createHmac('sha256', config.authTokenSecret).update(token).digest('hex');
}
