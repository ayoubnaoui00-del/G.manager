import bcrypt from 'bcrypt';
import { query } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { signToken } from '../utils/jwt.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_SALT_ROUNDS = 10;

/**
 * Register a new gym owner.
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, gym_name } = req.body || {};

  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ApiError(400, 'Name is required.');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
    throw new ApiError(400, 'A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new ApiError(400, 'Password is required and must be at least 6 characters long.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  const resolvedGymName =
    gym_name && typeof gym_name === 'string' && gym_name.trim().length > 0
      ? gym_name.trim()
      : 'My Gym';

  // Check if user already exists
  const existingUser = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existingUser.rows.length > 0) {
    throw new ApiError(409, 'An account with this email address already exists.');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  // Insert user
  const insertResult = await query(
    `INSERT INTO users (name, email, password_hash, gym_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, gym_name, created_at`,
    [trimmedName, normalizedEmail, passwordHash, resolvedGymName]
  );

  const newUser = insertResult.rows[0];

  // Sign JWT token
  const token = signToken({ id: newUser.id, email: newUser.email });

  res.status(201).json({
    success: true,
    message: 'User registered successfully.',
    data: {
      user: newUser,
      token,
    },
  });
});

/**
 * Log in an existing gym owner.
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
    throw new ApiError(400, 'Email and password are required.');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Find user by email
  const userResult = await query(
    'SELECT id, name, email, password_hash, gym_name, created_at FROM users WHERE email = $1',
    [normalizedEmail]
  );

  if (userResult.rows.length === 0) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const user = userResult.rows[0];

  // Compare passwords
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  // Generate JWT token
  const token = signToken({ id: user.id, email: user.email });

  res.status(200).json({
    success: true,
    message: 'Login successful.',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        gym_name: user.gym_name,
        created_at: user.created_at,
      },
      token,
    },
  });
});

/**
 * Get profile of currently authenticated gym owner.
 * GET /api/auth/me
 */
export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
});
