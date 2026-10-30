import pg from 'pg';
import env from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL idle client error:', err.message);
});

/**
 * Execute a SQL query using the connection pool.
 * @param {string} text - SQL query string
 * @param {Array} [params] - Query parameters
 */
export const query = (text, params) => pool.query(text, params);

/**
 * Verify database connectivity.
 */
export const checkDbConnection = async () => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT NOW() AS current_time');
    return { connected: true, timestamp: result.rows[0].current_time };
  } finally {
    client.release();
  }
};
