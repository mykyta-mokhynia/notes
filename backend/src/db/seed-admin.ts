import { config } from '../config';
import { hashPassword } from '../auth/password';
import { pool } from './index';
import { upsertAdminUser } from './users';

export async function seedAdminFromEnv(): Promise<void> {
  if (!config.databaseUrl.trim()) {
    throw new Error('DATABASE_URL is required');
  }
  if (!config.adminSeedEmail || !config.adminSeedPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  }

  await upsertAdminUser({
    email: config.adminSeedEmail,
    passwordHash: await hashPassword(config.adminSeedPassword),
    nickname: config.adminSeedNickname,
  });
}

async function run(): Promise<void> {
  await seedAdminFromEnv();
  await pool.end();
  console.log('Admin seed completed.');
}

if (require.main === module) {
  run().catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
}
