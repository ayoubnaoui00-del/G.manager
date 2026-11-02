import { pool } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const paymentMethods = new Set(['cash', 'card', 'transfer']);
const maxPaymentAmount = 99_999_999.99;

const parseId = (value) => {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && !/^\d+$/.test(value))
  ) {
    return null;
  }

  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const isValidDate = (value) => {
  if (typeof value !== 'string') return false;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const toCents = (value) => {
  const match = /^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!match) throw new Error('Invalid monetary value from database');

  const [, whole, fraction = '', exponentText = '0'] = match;
  const digits = BigInt(`${whole}${fraction}`);
  const centsShift = 2 - fraction.length + Number(exponentText);

  if (centsShift >= 0) {
    return Number(digits * 10n ** BigInt(centsShift));
  }

  const divisor = 10n ** BigInt(-centsShift);
  return Number((digits + divisor / 2n) / divisor);
};

const formatCents = (cents) =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

export const createPayment = asyncHandler(async (req, res) => {
  const body = req.body ?? {};
  const memberId = parseId(body.member_id);
  const subscriptionId =
    body.subscription_id === undefined || body.subscription_id === null
      ? null
      : parseId(body.subscription_id);
  const amount = body.amount;
  const paymentMethod =
    body.payment_method === undefined ? 'cash' : body.payment_method;
  const paymentDate =
    body.payment_date === undefined
      ? new Date().toISOString().slice(0, 10)
      : body.payment_date;

  if (memberId === null) {
    throw new ApiError(400, 'A valid member_id is required.');
  }
  if (
    subscriptionId === null &&
    body.subscription_id !== undefined &&
    body.subscription_id !== null
  ) {
    throw new ApiError(400, 'A valid subscription_id is required.');
  }
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > maxPaymentAmount
  ) {
    throw new ApiError(400, 'amount must be a number greater than 0.');
  }
  if (!paymentMethods.has(paymentMethod)) {
    throw new ApiError(
      400,
      "payment_method must be 'cash', 'card', or 'transfer'."
    );
  }
  if (!isValidDate(paymentDate)) {
    throw new ApiError(400, 'payment_date must be a valid YYYY-MM-DD date.');
  }

  const amountInCents = toCents(amount);
  if (amountInCents <= 0) {
    throw new ApiError(400, 'amount must be at least 0.01.');
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const memberResult = await client.query(
      'SELECT id FROM members WHERE id = $1 FOR KEY SHARE',
      [memberId]
    );
    if (memberResult.rowCount === 0) {
      throw new ApiError(404, 'Member not found.');
    }

    if (subscriptionId !== null) {
      const subscriptionResult = await client.query(
        `SELECT s.id, s.member_id, p.price
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         WHERE s.id = $1
         FOR UPDATE OF s, p`,
        [subscriptionId]
      );
      if (subscriptionResult.rowCount === 0) {
        throw new ApiError(404, 'Subscription not found.');
      }

      const subscription = subscriptionResult.rows[0];
      if (subscription.member_id !== memberId) {
        throw new ApiError(400, 'Subscription does not belong to this member.');
      }

      const paymentsResult = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS total_paid
         FROM payments
         WHERE subscription_id = $1`,
        [subscriptionId]
      );
      const planPriceInCents = toCents(subscription.price);
      const totalPaidInCents = toCents(paymentsResult.rows[0].total_paid);
      const remainingInCents = Math.max(
        planPriceInCents - totalPaidInCents,
        0
      );

      if (amountInCents > remainingInCents) {
        throw new ApiError(
          400,
          `Payment exceeds the remaining balance of ${formatCents(remainingInCents)} MAD.`
        );
      }
    }

    const insertResult = await client.query(
      `INSERT INTO payments
         (member_id, subscription_id, amount, payment_date, payment_method, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        memberId,
        subscriptionId,
        formatCents(amountInCents),
        paymentDate,
        paymentMethod,
        body.notes ?? null,
      ]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    res.status(201).json({ success: true, data: insertResult.rows[0] });
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
});

export const getPayments = asyncHandler(async (req, res) => {
  const filters = [];
  const params = [];
  let whereClause = '';

  if (req.query.member_id !== undefined) {
    const memberId = parseId(req.query.member_id);
    if (memberId === null) {
      throw new ApiError(400, 'member_id must be a valid positive integer.');
    }

    params.push(memberId);
    filters.push(`p.member_id = $${params.length}`);
  }

  for (const [queryKey, column] of [
    ['start_date', 'p.payment_date >='],
    ['end_date', 'p.payment_date <='],
  ]) {
    const date = req.query[queryKey];
    if (date !== undefined) {
      if (!isValidDate(date)) {
        throw new ApiError(
          400,
          `${queryKey} must be a valid YYYY-MM-DD date.`
        );
      }

      params.push(date);
      filters.push(`${column} $${params.length}`);
    }
  }

  if (req.query.method !== undefined) {
    if (!paymentMethods.has(req.query.method)) {
      throw new ApiError(
        400,
        "method must be 'cash', 'card', or 'transfer'."
      );
    }

    params.push(req.query.method);
    filters.push(`p.payment_method = $${params.length}`);
  }

  if (filters.length > 0) {
    whereClause = `WHERE ${filters.join(' AND ')}`;
  }

  const result = await pool.query(
    `SELECT p.*, m.full_name AS member_name, pl.name AS plan_name
     FROM payments p
     JOIN members m ON m.id = p.member_id
     LEFT JOIN subscriptions s ON s.id = p.subscription_id
     LEFT JOIN plans pl ON pl.id = s.plan_id
     ${whereClause}
     ORDER BY p.payment_date DESC, p.id DESC`,
    params
  );

  res.status(200).json({
    success: true,
    count: result.rows.length,
    data: result.rows,
  });
});

export const getPaymentById = asyncHandler(async (req, res) => {
  const paymentId = parseId(req.params.id);
  if (paymentId === null) {
    throw new ApiError(400, 'id must be a positive integer.');
  }

  const result = await pool.query(
    `SELECT p.*, m.full_name AS member_name, m.phone AS member_phone,
            pl.name AS plan_name, pl.price AS plan_price,
            s.start_date AS subscription_start_date,
            s.end_date AS subscription_end_date
     FROM payments p
     JOIN members m ON m.id = p.member_id
     LEFT JOIN subscriptions s ON s.id = p.subscription_id
     LEFT JOIN plans pl ON pl.id = s.plan_id
     WHERE p.id = $1`,
    [paymentId]
  );

  if (result.rowCount === 0) {
    throw new ApiError(404, 'Payment not found.');
  }

  res.status(200).json({ success: true, data: result.rows[0] });
});
