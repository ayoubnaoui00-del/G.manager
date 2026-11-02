import express from 'express';
import dashboardRoutes from './dashboard.routes.js';
import healthRoutes from './health.routes.js';
import paymentRoutes from './payment.routes.js';

const router = express.Router();

// Health check endpoint
router.use('/health', healthRoutes);

// Future module routes to be mounted by the team:
// router.use('/auth', authRoutes);             // Dev 1 (GM-7)
// router.use('/members', memberRoutes);        // Dev 2 (GM-11)
// router.use('/plans', planRoutes);            // Dev 3 (GM-16)
// router.use('/subscriptions', subRoutes);     // Dev 3 (GM-17)
router.use('/payments', paymentRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
