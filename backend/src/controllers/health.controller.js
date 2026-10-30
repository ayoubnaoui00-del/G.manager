import { checkDbConnection } from '../config/db.js';

/**
 * GET /api/health
 * Returns server status and PostgreSQL database connectivity status.
 */
export const getHealthStatus = async (req, res) => {
  let dbStatus = { connected: false, timestamp: null, error: null };

  try {
    const dbCheck = await checkDbConnection();
    dbStatus = {
      connected: dbCheck.connected,
      timestamp: dbCheck.timestamp,
    };
  } catch (err) {
    dbStatus = {
      connected: false,
      timestamp: null,
      error: err.message,
    };
  }

  res.status(200).json({
    success: true,
    service: 'G.manager Gym Subscription API',
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
};
