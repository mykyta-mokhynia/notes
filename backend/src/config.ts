import 'dotenv/config';

function optional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  port: parseInt(optional('PORT', '3000'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:4200'),
  databaseUrl: optional('DATABASE_URL', ''),
} as const;
