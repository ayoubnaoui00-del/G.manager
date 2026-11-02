import { verifyToken } from '../utils/jwt.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { query } from '../config/db.js';

/**
 * Authentication middleware to verify JWT tokens and attach the authenticated gym owner to req.user.
 */
export const authMiddleware = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Authentication token missing or invalid. Format: Bearer <token>');
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    throw new ApiError(401, 'Authentication token missing or invalid.');
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Authentication token has expired. Please log in again.');
    }
    throw new ApiError(401, 'Invalid authentication token.');
  }

  if (!decoded || !decoded.id) {
    throw new ApiError(401, 'Malformed authentication token payload.');
  }

  // Verify the user still exists in the database
  const result = await query(
    'SELECT id, name, email, gym_name, created_at FROM users WHERE id = $1',
    [decoded.id]
  );

  if (result.rows.length === 0) {
    throw new ApiError(401, 'User associated with this token no longer exists.');
  }

  req.user = result.rows[0];
  next();
});

export const protect = authMiddleware;
export default authMiddleware;
