import { query } from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const [
    memberCountResult,
    subscriptionCountsResult,
    expiringSubscriptionsResult,
    revenueResult,
    recentPaymentsResult,
  ] = await Promise.all([
    query('SELECT COUNT(*)::int AS count FROM members', []),
    query(
      `WITH latest_subscriptions AS (
         SELECT DISTINCT ON (member_id) member_id, end_date
         FROM subscriptions
         ORDER BY member_id, end_date DESC
       )
       SELECT
         COUNT(*) FILTER (WHERE end_date >= CURRENT_DATE)::int AS active,
         COUNT(*) FILTER (WHERE end_date < CURRENT_DATE)::int AS expired
       FROM latest_subscriptions`,
      []
    ),
    query(
      `WITH latest_subscriptions AS (
         SELECT DISTINCT ON (member_id)
                id, member_id, plan_id, end_date
         FROM subscriptions
         ORDER BY member_id, end_date DESC
       )
       SELECT m.id AS member_id, m.full_name, m.phone,
              s.id AS subscription_id, pl.name AS plan_name,
              s.end_date, s.end_date - CURRENT_DATE AS days_remaining
       FROM latest_subscriptions s
       JOIN members m ON m.id = s.member_id
       JOIN plans pl ON pl.id = s.plan_id
       WHERE s.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
       ORDER BY s.end_date ASC`,
      []
    ),
    query(
      `SELECT
         COALESCE(SUM(amount) FILTER (
           WHERE payment_date >= date_trunc('month', CURRENT_DATE)::date
             AND payment_date < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
         ), 0) AS current_month,
         COALESCE(SUM(amount), 0) AS all_time
       FROM payments`,
      []
    ),
    query(
      `SELECT p.*, m.full_name AS member_name, pl.name AS plan_name
       FROM payments p
       JOIN members m ON m.id = p.member_id
       LEFT JOIN subscriptions s ON s.id = p.subscription_id
       LEFT JOIN plans pl ON pl.id = s.plan_id
       ORDER BY p.payment_date DESC, p.id DESC
       LIMIT $1`,
      [5]
    ),
  ]);

  const subscriptionCounts = subscriptionCountsResult.rows[0];
  const revenue = revenueResult.rows[0];
  const recentPayments = recentPaymentsResult.rows.map((payment) => ({
    ...payment,
    amount: Number(payment.amount),
  }));
  const expiringItems = expiringSubscriptionsResult.rows;

  res.status(200).json({
    success: true,
    data: {
      total_members: memberCountResult.rows[0].count,
      active_subscriptions: subscriptionCounts.active,
      expired_subscriptions: subscriptionCounts.expired,
      expiring_soon: {
        count: expiringItems.length,
        items: expiringItems,
      },
      revenue: {
        current_month: Number(revenue.current_month),
        all_time: Number(revenue.all_time),
        recent_payments: recentPayments,
      },
    },
  });
});
