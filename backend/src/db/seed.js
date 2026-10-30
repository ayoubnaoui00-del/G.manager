import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Seed sample gym owner, plans, members, subscriptions, and payments
 * so all 4 developers have realistic test data for API & mobile screens.
 */
export const seedDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('Starting database seed...');
    await client.query('BEGIN');

    // Clear existing data cleanly
    await client.query(
      'TRUNCATE payments, subscriptions, plans, members, users RESTART IDENTITY CASCADE'
    );

    // 1. Seed Default Gym Owner (email: owner@gmanager.com | password: password123)
    let passwordHash =
      '$2b$10$CwTycUXWue0Thq9StjUM0uJ8D0R/bC4T5yM1ZqP7jX0xV9K5vY6aO';
    try {
      passwordHash = await bcrypt.hash('password123', 10);
    } catch (_) {
      // Fallback precomputed bcrypt hash if native bcrypt isn't built yet
    }

    const ownerRes = await client.query(
      `INSERT INTO users (name, email, password_hash, gym_name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, gym_name`,
      ['Ennaoui Ayoub', 'owner@gmanager.com', passwordHash, 'Atlas Fitness Club']
    );
    console.log('Seeded gym owner:', ownerRes.rows[0].email);

    // 2. Seed Membership Plans
    const plansRes = await client.query(
      `INSERT INTO plans (name, duration_days, price, description, is_active)
       VALUES
         ('Monthly Standard', 30, 250.00, 'Full gym floor & cardio access for 30 days', TRUE),
         ('Quarterly Pro', 90, 650.00, '3 months access + 1 free personal training session', TRUE),
         ('Annual VIP', 365, 2200.00, '12 months unlimited access + locker & sauna', TRUE),
         ('Weekly Pass', 7, 80.00, 'Short-term 7-day gym pass for visitors', TRUE)
       RETURNING id, name, duration_days, price`
    );
    const plans = plansRes.rows;
    console.log(`Seeded ${plans.length} membership plans.`);

    // 3. Seed Members
    const membersRes = await client.query(
      `INSERT INTO members (full_name, phone, email, status, join_date, notes)
       VALUES
         ('Youssef El Amrani', '+212600112233', 'youssef@example.com', 'active', CURRENT_DATE - INTERVAL '45 days', 'Prefers morning workouts'),
         ('Salma Bennani', '+212600223344', 'salma@example.com', 'active', CURRENT_DATE - INTERVAL '25 days', 'Training for marathon'),
         ('Karim Tazi', '+212600334455', 'karim@example.com', 'active', CURRENT_DATE - INTERVAL '85 days', 'Subscription expiring soon'),
         ('Nadia Chraibi', '+212600445566', 'nadia@example.com', 'expired', CURRENT_DATE - INTERVAL '60 days', 'Needs renewal follow-up'),
         ('Omar Idrissi', '+212600556677', 'omar@example.com', 'active', CURRENT_DATE - INTERVAL '10 days', 'Annual VIP member')
       RETURNING id, full_name, status`
    );
    const members = membersRes.rows;
    console.log(`Seeded ${members.length} gym members.`);

    // 4. Seed Subscriptions (active, expiring within 7 days, and expired)
    const subsRes = await client.query(
      `INSERT INTO subscriptions (member_id, plan_id, start_date, end_date, status)
       VALUES
         -- Youssef: Active Monthly (20 days left)
         ($1, $6, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '20 days', 'active'),
         -- Salma: Active Monthly (expiring in 5 days -> shows in Expiring Soon!)
         ($2, $6, CURRENT_DATE - INTERVAL '25 days', CURRENT_DATE + INTERVAL '5 days', 'active'),
         -- Karim: Active Quarterly (expiring in 3 days -> shows in Expiring Soon!)
         ($3, $7, CURRENT_DATE - INTERVAL '87 days', CURRENT_DATE + INTERVAL '3 days', 'active'),
         -- Nadia: Expired Monthly (expired 15 days ago)
         ($4, $6, CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '15 days', 'expired'),
         -- Omar: Active Annual VIP
         ($5, $8, CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE + INTERVAL '355 days', 'active')
       RETURNING id, member_id, plan_id, status`,
      [
        members[0].id,
        members[1].id,
        members[2].id,
        members[3].id,
        members[4].id,
        plans[0].id, // Monthly (250)
        plans[1].id, // Quarterly (650)
        plans[2].id, // Annual VIP (2200)
      ]
    );
    const subs = subsRes.rows;
    console.log(`Seeded ${subs.length} subscriptions.`);

    // 5. Seed Payments
    const paymentsRes = await client.query(
      `INSERT INTO payments (subscription_id, member_id, amount, payment_date, payment_method, notes)
       VALUES
         ($1, $6, 250.00, CURRENT_DATE - INTERVAL '10 days', 'cash', 'Monthly Standard renewal'),
         ($2, $7, 250.00, CURRENT_DATE - INTERVAL '25 days', 'card', 'Monthly Standard initial payment'),
         ($3, $8, 650.00, CURRENT_DATE - INTERVAL '87 days', 'transfer', 'Quarterly Pro package'),
         ($4, $9, 250.00, CURRENT_DATE - INTERVAL '45 days', 'cash', 'Monthly Standard'),
         ($5, $10, 2200.00, CURRENT_DATE - INTERVAL '10 days', 'card', 'Annual VIP full payment')
       RETURNING id, amount`,
      [
        subs[0].id,
        subs[1].id,
        subs[2].id,
        subs[3].id,
        subs[4].id,
        members[0].id,
        members[1].id,
        members[2].id,
        members[3].id,
        members[4].id,
      ]
    );
    console.log(`Seeded ${paymentsRes.rows.length} payments.`);

    await client.query('COMMIT');
    console.log('Database seeding completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Database seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  seedDatabase();
}
