import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedUser } from '../types';
import * as usersDb from '../db/users';
import { verifyAccessToken } from './token';

type AuthRequest = Request & { auth?: AuthenticatedUser };

function readBearerToken(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new Error('INVALID_AUTH_HEADER');
  }
  return token;
}

export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authReq = req as AuthRequest;
  try {
    const token = readBearerToken(req);
    if (!token) {
      authReq.auth = undefined;
      next();
      return;
    }

    const payload = verifyAccessToken(token);
    const user = await usersDb.getUserById(payload.sub);
    if (!user || user.role !== payload.role) {
      res.status(401).json({ error: 'AUTH_INVALID' });
      return;
    }

    authReq.auth = {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatar_initials: user.avatar_initials,
      avatar_color: user.avatar_color,
      profile_completed: user.profile_completed,
      role: user.role,
    };
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AUTH_INVALID';
    res.status(401).json({ error: message });
  }
}

export function requireAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthRequest;
  if (!authReq.auth) {
    res.status(401).json({ error: 'AUTH_REQUIRED' });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authReq = req as AuthRequest;
  if (authReq.auth?.role !== 'ADMIN') {
    res.status(403).json({ error: 'ADMIN_REQUIRED' });
    return;
  }
  next();
}

export function canReadPrivate(req: Request): boolean {
  const authReq = req as AuthRequest;
  return authReq.auth?.role === 'ADMIN';
}
