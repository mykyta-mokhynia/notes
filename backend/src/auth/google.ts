import { config } from '../config';

interface GoogleTokenInfoResponse {
  aud?: string;
  sub?: string;
  email?: string;
  email_verified?: string;
  name?: string;
}

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  name: string | null;
}

export async function verifyGoogleIdToken(
  idToken: string
): Promise<VerifiedGoogleIdentity> {
  if (!config.googleClientId) {
    throw new Error('GOOGLE_AUTH_DISABLED');
  }

  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('GOOGLE_TOKEN_INVALID');
  }

  const payload = (await response.json()) as GoogleTokenInfoResponse;
  if (payload.aud !== config.googleClientId) {
    throw new Error('GOOGLE_AUDIENCE_INVALID');
  }
  if (!payload.sub || !payload.email || payload.email_verified !== 'true') {
    throw new Error('GOOGLE_PROFILE_INVALID');
  }

  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: typeof payload.name === 'string' ? payload.name.trim() || null : null,
  };
}
