import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

export { pool };
export const query = pool.query.bind(pool);
