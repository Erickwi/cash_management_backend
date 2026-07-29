import { logger } from './utils/logger';
import { query } from './db';
import fs from 'fs';
import path from 'path';

async function initDb() {
  logger.info('Initializing database...');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await query(stmt);
      logger.info('Executed:', stmt.substring(0, 60) + '...');
    } catch (err: any) {
      logger.error('Error executing:', stmt.substring(0, 60));
      logger.error(err.message);
    }
  }
  logger.info('Database initialization complete.');
  process.exit(0);
}

initDb().catch(err => {
  logger.error('Database initialization failed:', err);
  process.exit(1);
});

