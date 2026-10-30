import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export const runMigrations = async (direction = 'up') => {
  const suffix = direction === 'down' ? '.down.sql' : '.up.sql';
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(suffix))
    .sort((a, b) =>
      direction === 'down' ? b.localeCompare(a) : a.localeCompare(b)
    );

  if (files.length === 0) {
    console.log(`No migration files found matching *${suffix}`);
    return;
  }

  const client = await pool.connect();
  try {
    for (const file of files) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`Running migration [${direction.toUpperCase()}]: ${file}...`);
      await client.query(sql);
      console.log(`Completed migration: ${file}`);
    }
    console.log(`All ${direction.toUpperCase()} migrations executed successfully.`);
  } catch (err) {
    console.error(`Migration failed:`, err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  runMigrations(direction);
}
