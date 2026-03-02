/**
 * Simple migration runner: runs SQL files from migrations/ in order.
 * Tracks applied migrations in schema_migrations table (created on first run).
 */
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { pool } from './index';

const MIGRATIONS_DIR = join(__dirname, '../../migrations');

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function appliedMigrations(): Promise<Set<string>> {
  const { rows } = await pool.query<{ name: string }>(
    'SELECT name FROM schema_migrations ORDER BY name'
  );
  return new Set(rows.map((r) => r.name));
}

async function run(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  await ensureMigrationsTable();
  const applied = await appliedMigrations();
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const name = file.replace(/\.sql$/, '');
    if (applied.has(name)) {
      console.log('Skip (already applied):', file);
      continue;
    }
    const filepath = join(MIGRATIONS_DIR, file);
    const sql = await readFile(filepath, 'utf-8');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    console.log('Applied:', file);
  }
  await pool.end();
  console.log('Migrations done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
