import 'dotenv/config';

function optional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function optionalInt(key: string, defaultValue: number): number {
  return parseInt(optional(key, String(defaultValue)), 10);
}

function optionalBoolean(key: string, defaultValue: boolean): boolean {
  const value = optional(key, defaultValue ? 'true' : 'false').trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes' || value === 'on';
}

export const config = {
  port: optionalInt('PORT', 3000),
  nodeEnv: optional('NODE_ENV', 'development'),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:4200'),
  databaseUrl: optional('DATABASE_URL', ''),
  authTokenSecret: optional('AUTH_TOKEN_SECRET', 'dev-notes-auth-secret'),
  accessTokenTtlMinutes: optionalInt('ACCESS_TOKEN_TTL_MINUTES', 15),
  refreshTokenTtlDays: optionalInt('REFRESH_TOKEN_TTL_DAYS', 30),
  refreshTokenCookieName: optional('REFRESH_TOKEN_COOKIE_NAME', 'notes_refresh_token'),
  passwordResetTtlMinutes: optionalInt('PASSWORD_RESET_TTL_MINUTES', 30),
  appBaseUrl: optional('APP_BASE_URL', 'http://localhost:4200'),
  smtpHost: optional('SMTP_HOST', ''),
  smtpPort: optionalInt('SMTP_PORT', 587),
  smtpSecure: optionalBoolean('SMTP_SECURE', false),
  smtpUser: optional('SMTP_USER', ''),
  smtpPass: optional('SMTP_PASS', ''),
  smtpFromEmail: optional('SMTP_FROM_EMAIL', ''),
  smtpFromName: optional('SMTP_FROM_NAME', 'Notes'),
  googleClientId: optional('GOOGLE_CLIENT_ID', ''),
  adminSeedEmail: optional('ADMIN_EMAIL', ''),
  adminSeedPassword: optional('ADMIN_PASSWORD', ''),
  adminSeedNickname: optional('ADMIN_NICKNAME', 'Admin'),
} as const;
