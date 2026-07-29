import { Pool } from 'pg';
import dotenv from 'dotenv';
import { logger } from './utils/logger';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function query(text: string, params?: any[]) {
  const result = await pool.query(text, params);
  return result;
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}

export default pool;
