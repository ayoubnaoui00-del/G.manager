import { query } from '../config/db.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const VALID_STATUSES = ['active', 'expired', 'inactive'];

/**
 * GET /api/members
 * List all members with optional query filters:
 *  - ?search= (case-insensitive search on full_name or phone)
 *  - ?status= (active, expired, inactive, or all)
 * Includes their current subscription status.
 */
export const getMembers = asyncHandler(async (req, res) => {
  const { search, status } = req.query;

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    conditions.push(`(m.full_name ILIKE $${paramIndex} OR m.phone ILIKE $${paramIndex})`);
    params.push(`%${search.trim()}%`);
    paramIndex++;
  }

  if (status && status.trim().toLowerCase() !== 'all') {
    conditions.push(`m.status = $${paramIndex}`);
    params.push(status.trim().toLowerCase());
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      m.id,
      m.full_name,
      m.phone,
      m.email,
      m.status,
      m.join_date,
      m.notes,
      m.created_at,
      s.id AS current_subscription_id,
      s.status AS subscription_status,
      s.start_date AS subscription_start_date,
      s.end_date AS subscription_end_date,
      p.id AS plan_id,
      p.name AS plan_name
    FROM members m
    LEFT JOIN LATERAL (
      SELECT sub.id, sub.plan_id, sub.status, sub.start_date, sub.end_date
      FROM subscriptions sub
      WHERE sub.member_id = m.id
      ORDER BY sub.end_date DESC, sub.id DESC
      LIMIT 1
    ) s ON true
    LEFT JOIN plans p ON p.id = s.plan_id
    ${whereClause}
    ORDER BY m.id DESC;
  `;

  const result = await query(sql, params);

  const data = result.rows.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    status: row.status,
    join_date: row.join_date,
    notes: row.notes,
    created_at: row.created_at,
    current_subscription: row.current_subscription_id
      ? {
          id: row.current_subscription_id,
          status: row.subscription_status,
          start_date: row.subscription_start_date,
          end_date: row.subscription_end_date,
          plan_id: row.plan_id,
          plan_name: row.plan_name,
        }
      : null,
  }));

  res.status(200).json({
    success: true,
    count: data.length,
    data,
  });
});

/**
 * GET /api/members/:id
 * Return member profile along with their subscription and payment history.
 */
export const getMemberById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const memberRes = await query('SELECT * FROM members WHERE id = $1', [id]);
  if (memberRes.rows.length === 0) {
    throw new ApiError(404, `Member with ID ${id} not found`);
  }

  const subscriptionsRes = await query(
    `SELECT 
       s.id,
       s.plan_id,
       p.name AS plan_name,
       p.price AS plan_price,
       s.start_date,
       s.end_date,
       s.status,
       s.created_at
     FROM subscriptions s
     LEFT JOIN plans p ON p.id = s.plan_id
     WHERE s.member_id = $1
     ORDER BY s.start_date DESC, s.id DESC`,
    [id]
  );

  const paymentsRes = await query(
    `SELECT 
       p.id,
       p.subscription_id,
       p.amount,
       p.payment_date,
       p.payment_method,
       p.notes,
       p.created_at
     FROM payments p
     WHERE p.member_id = $1
     ORDER BY p.payment_date DESC, p.id DESC`,
    [id]
  );

  res.status(200).json({
    success: true,
    data: {
      ...memberRes.rows[0],
      subscriptions: subscriptionsRes.rows,
      payments: paymentsRes.rows,
    },
  });
});

/**
 * POST /api/members
 * Create a new member.
 * Required: full_name, phone.
 * Optional: email, status ('active', 'expired', 'inactive'), join_date, notes.
 */
export const createMember = asyncHandler(async (req, res) => {
  const { full_name, phone, email, status, join_date, notes } = req.body;

  if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
    throw new ApiError(400, 'full_name is required');
  }

  if (!phone || typeof phone !== 'string' || !phone.trim()) {
    throw new ApiError(400, 'phone is required');
  }

  if (email && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
    throw new ApiError(400, 'Invalid email format');
  }

  const memberStatus = status ? status.trim().toLowerCase() : 'active';
  if (!VALID_STATUSES.includes(memberStatus)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const result = await query(
    `INSERT INTO members (full_name, phone, email, status, join_date, notes)
     VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6)
     RETURNING *`,
    [
      full_name.trim(),
      phone.trim(),
      email ? email.trim() : null,
      memberStatus,
      join_date || null,
      notes ? notes.trim() : null,
    ]
  );

  res.status(201).json({
    success: true,
    message: 'Member created successfully',
    data: result.rows[0],
  });
});

/**
 * PUT /api/members/:id
 * Update member details.
 */
export const updateMember = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { full_name, phone, email, status, join_date, notes } = req.body;

  const checkRes = await query('SELECT * FROM members WHERE id = $1', [id]);
  if (checkRes.rows.length === 0) {
    throw new ApiError(404, `Member with ID ${id} not found`);
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (full_name !== undefined) {
    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      throw new ApiError(400, 'full_name cannot be empty');
    }
    fields.push(`full_name = $${paramIndex++}`);
    values.push(full_name.trim());
  }

  if (phone !== undefined) {
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      throw new ApiError(400, 'phone cannot be empty');
    }
    fields.push(`phone = $${paramIndex++}`);
    values.push(phone.trim());
  }

  if (email !== undefined) {
    if (email && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      throw new ApiError(400, 'Invalid email format');
    }
    fields.push(`email = $${paramIndex++}`);
    values.push(email ? email.trim() : null);
  }

  if (status !== undefined) {
    const memberStatus = status.trim().toLowerCase();
    if (!VALID_STATUSES.includes(memberStatus)) {
      throw new ApiError(400, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }
    fields.push(`status = $${paramIndex++}`);
    values.push(memberStatus);
  }

  if (join_date !== undefined) {
    fields.push(`join_date = $${paramIndex++}`);
    values.push(join_date);
  }

  if (notes !== undefined) {
    fields.push(`notes = $${paramIndex++}`);
    values.push(notes ? notes.trim() : null);
  }

  if (fields.length === 0) {
    throw new ApiError(400, 'No valid fields provided for update');
  }

  values.push(id);
  const updateSql = `
    UPDATE members
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await query(updateSql, values);

  res.status(200).json({
    success: true,
    message: 'Member updated successfully',
    data: result.rows[0],
  });
});

/**
 * DELETE /api/members/:id
 * Remove/delete a member.
 */
export const deleteMember = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const checkRes = await query('SELECT id, full_name FROM members WHERE id = $1', [id]);
  if (checkRes.rows.length === 0) {
    throw new ApiError(404, `Member with ID ${id} not found`);
  }

  await query('DELETE FROM members WHERE id = $1', [id]);

  res.status(200).json({
    success: true,
    message: `Member '${checkRes.rows[0].full_name}' deleted successfully`,
    data: { id: parseInt(id, 10) },
  });
});
