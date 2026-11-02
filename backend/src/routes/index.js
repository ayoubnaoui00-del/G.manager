import express from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import memberRoutes from './member.routes.js';
import paymentRoutes from './payment.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = express.Router();

// Health check endpoint
router.use('/health', healthRoutes);

// Authentication routes (GM-7)
router.use('/auth', authRoutes);

// Members API (CRUD + search + history) - GM-11
router.use('/members', memberRoutes);

// Payments & Dashboard routes (GM-21, GM-22)
router.use('/payments', paymentRoutes);
router.use('/dashboard', dashboardRoutes);

// Future module routes to be mounted by the team:
// router.use('/plans', planRoutes);            // Dev 3 (GM-16)
// router.use('/subscriptions', subRoutes);     // Dev 3 (GM-17)

export default router;
