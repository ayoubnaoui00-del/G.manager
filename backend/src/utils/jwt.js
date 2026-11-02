import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * Sign a JWT token with the given payload.
 * @param {object} payload - Data to encode (e.g. { id, email })
 * @param {string|number} [expiresIn] - Custom expiration, defaults to env.jwtExpiresIn
 * @returns {string} Signed JWT token
 */
export const signToken = (payload, expiresIn = env.jwtExpiresIn) => {
  return jwt.sign(payload, env.jwtSecret, { expiresIn });
};

/**
 * Verify and decode a JWT token.
 * @param {string} token - JWT token string
 * @returns {object} Decoded payload
 */
export const verifyToken = (token) => {
  return jwt.verify(token, env.jwtSecret);
};
