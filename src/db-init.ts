import { query } from './db';
import fs from 'fs';
import path from 'path';

async function initDb() {
  console.log('Initializing database...');
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    try {
      await query(stmt);
      console.log('Executed:', stmt.substring(0, 60) + '...');
    } catch (err: any) {
      console.error('Error executing:', stmt.substring(0, 60));
      console.error(err.message);
    }
  }
  console.log('Database initialization complete.');
  process.exit(0);
}

initDb().catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
