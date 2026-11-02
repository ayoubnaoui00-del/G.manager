import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { signToken, verifyToken } from '../src/utils/jwt.js';
import { pool } from '../src/config/db.js';
import { register, login, getMe } from '../src/controllers/auth.controller.js';
import { authMiddleware } from '../src/middlewares/auth.middleware.js';
import ApiError from '../src/utils/ApiError.js';

// Helper to create mock Express req, res, next
const createMockReqRes = (overrides = {}) => {
  const req = {
    body: {},
    headers: {},
    params: {},
    query: {},
    ...overrides,
  };

  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };

  let nextCalledWith = null;
  const next = (err = null) => {
    nextCalledWith = err;
  };

  return { req, res, next, getNextErr: () => nextCalledWith };
};

test('JWT Utilities - signToken and verifyToken', async (t) => {
  await t.test('should sign a valid token and verify its payload', () => {
    const payload = { id: 42, email: 'owner@gym.com' };
    const token = signToken(payload);
    assert.ok(typeof token === 'string' && token.length > 20);

    const decoded = verifyToken(token);
    assert.equal(decoded.id, 42);
    assert.equal(decoded.email, 'owner@gym.com');
  });

  await t.test('should throw on invalid/tampered token', () => {
    assert.throws(() => {
      verifyToken('invalid.token.signature');
    });
  });
});

test('Auth Middleware - Token verification and protection', async (t) => {
  await t.test('should return 401 if Authorization header is missing', async () => {
    const { req, res, next, getNextErr } = createMockReqRes({ headers: {} });
    await authMiddleware(req, res, next);
    const err = getNextErr();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 401);
    assert.match(err.message, /Authentication token missing/);
  });

  await t.test('should return 401 if Authorization header format is invalid', async () => {
    const { req, res, next, getNextErr } = createMockReqRes({
      headers: { authorization: 'Basic 12345' },
    });
    await authMiddleware(req, res, next);
    const err = getNextErr();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 401);
  });

  await t.test('should return 401 if token is invalid or expired', async () => {
    const { req, res, next, getNextErr } = createMockReqRes({
      headers: { authorization: 'Bearer bad_token_string' },
    });
    await authMiddleware(req, res, next);
    const err = getNextErr();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 401);
    assert.match(err.message, /Invalid authentication token/);
  });

  await t.test('should authenticate user and attach to req.user when token and user are valid', async () => {
    const token = signToken({ id: 1, email: 'owner@gmanager.com' });
    const { req, res, next, getNextErr } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` },
    });

    // Mock pool.query for user lookup
    const originalQuery = pool.query.bind(pool);
    pool.query = async (sql, params) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        return {
          rows: [
            {
              id: 1,
              name: 'Gym Owner',
              email: 'owner@gmanager.com',
              gym_name: 'Iron Forge',
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    };

    try {
      await authMiddleware(req, res, next);
      assert.equal(getNextErr(), null);
      assert.ok(req.user);
      assert.equal(req.user.id, 1);
      assert.equal(req.user.email, 'owner@gmanager.com');
    } finally {
      pool.query = originalQuery;
    }
  });
});

test('Auth Controller - Register', async (t) => {
  await t.test('should reject registration with missing name', async () => {
    const { req, res, next, getNextErr } = createMockReqRes({
      body: { email: 'test@gym.com', password: 'password123' },
    });
    await register(req, res, next);
    const err = getNextErr();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 400);
    assert.match(err.message, /Name is required/);
  });

  await t.test('should reject registration with invalid email', async () => {
    const { req, res, next, getNextErr } = createMockReqRes({
      body: { name: 'Owner', email: 'not-an-email', password: 'password123' },
    });
    await register(req, res, next);
    const err = getNextErr();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 400);
    assert.match(err.message, /valid email/);
  });

  await t.test('should reject registration with password < 6 characters', async () => {
    const { req, res, next, getNextErr } = createMockReqRes({
      body: { name: 'Owner', email: 'test@gym.com', password: '123' },
    });
    await register(req, res, next);
    const err = getNextErr();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 400);
    assert.match(err.message, /at least 6 characters/);
  });

  await t.test('should reject registration if email already exists (409)', async () => {
    const { req, res, next, getNextErr } = createMockReqRes({
      body: { name: 'Owner', email: 'exists@gym.com', password: 'password123' },
    });

    const originalQuery = pool.query.bind(pool);
    pool.query = async (sql) => {
      if (sql.includes('SELECT id FROM users WHERE email')) {
        return { rows: [{ id: 99 }] };
      }
      return { rows: [] };
    };

    try {
      await register(req, res, next);
      const err = getNextErr();
      assert.ok(err instanceof ApiError);
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /already exists/);
    } finally {
      pool.query = originalQuery;
    }
  });

  await t.test('should successfully register owner and return 201 with token', async () => {
    const { req, res, next, getNextErr } = createMockReqRes({
      body: {
        name: 'Alex Iron',
        email: 'alex@ironforge.com',
        password: 'securepassword',
        gym_name: 'Iron Forge Club',
      },
    });

    const originalQuery = pool.query.bind(pool);
    pool.query = async (sql, params) => {
      if (sql.includes('SELECT id FROM users WHERE email')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO users')) {
        return {
          rows: [
            {
              id: 10,
              name: params[0],
              email: params[1],
              gym_name: params[3],
              created_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    };

    try {
      await register(req, res, next);
      assert.equal(getNextErr(), null);
      assert.equal(res.statusCode, 201);
      assert.equal(res.jsonData.success, true);
      assert.equal(res.jsonData.data.user.email, 'alex@ironforge.com');
      assert.ok(res.jsonData.data.token);
      assert.equal(res.jsonData.data.user.password_hash, undefined);
    } finally {
      pool.query = originalQuery;
    }
  });
});

test('Auth Controller - Login', async (t) => {
  await t.test('should reject missing email or password', async () => {
    const { req, res, next, getNextErr } = createMockReqRes({ body: {} });
    await login(req, res, next);
    const err = getNextErr();
    assert.ok(err instanceof ApiError);
    assert.equal(err.statusCode, 400);
  });

  await t.test('should reject non-existent user with 401', async () => {
    const { req, res, next, getNextErr } = createMockReqRes({
      body: { email: 'unknown@gym.com', password: 'password123' },
    });

    const originalQuery = pool.query.bind(pool);
    pool.query = async () => ({ rows: [] });

    try {
      await login(req, res, next);
      const err = getNextErr();
      assert.ok(err instanceof ApiError);
      assert.equal(err.statusCode, 401);
    } finally {
      pool.query = originalQuery;
    }
  });

  await t.test('should reject wrong password with 401', async () => {
    const hashedPassword = await bcrypt.hash('correctpassword', 10);
    const { req, res, next, getNextErr } = createMockReqRes({
      body: { email: 'owner@gym.com', password: 'wrongpassword' },
    });

    const originalQuery = pool.query.bind(pool);
    pool.query = async () => ({
      rows: [
        {
          id: 5,
          name: 'Owner',
          email: 'owner@gym.com',
          password_hash: hashedPassword,
          gym_name: 'Gym',
          created_at: new Date().toISOString(),
        },
      ],
    });

    try {
      await login(req, res, next);
      const err = getNextErr();
      assert.ok(err instanceof ApiError);
      assert.equal(err.statusCode, 401);
    } finally {
      pool.query = originalQuery;
    }
  });

  await t.test('should successfully login and return 200 with token and sanitized user', async () => {
    const hashedPassword = await bcrypt.hash('secret123', 10);
    const { req, res, next, getNextErr } = createMockReqRes({
      body: { email: 'owner@gym.com', password: 'secret123' },
    });

    const originalQuery = pool.query.bind(pool);
    pool.query = async () => ({
      rows: [
        {
          id: 7,
          name: 'Gym Boss',
          email: 'owner@gym.com',
          password_hash: hashedPassword,
          gym_name: 'Fitness World',
          created_at: new Date().toISOString(),
        },
      ],
    });

    try {
      await login(req, res, next);
      assert.equal(getNextErr(), null);
      assert.equal(res.statusCode, 200);
      assert.equal(res.jsonData.success, true);
      assert.equal(res.jsonData.data.user.email, 'owner@gym.com');
      assert.ok(res.jsonData.data.token);
      assert.equal(res.jsonData.data.user.password_hash, undefined);
    } finally {
      pool.query = originalQuery;
    }
  });
});

test('Auth Controller - getMe', async (t) => {
  await t.test('should return authenticated user profile', async () => {
    const userProfile = { id: 1, name: 'Boss', email: 'boss@gym.com', gym_name: 'PowerGym' };
    const { req, res, next } = createMockReqRes({ user: userProfile });

    await getMe(req, res, next);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.jsonData.data.user, userProfile);
  });
});
