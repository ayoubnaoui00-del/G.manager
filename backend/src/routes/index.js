import express from 'express';
import healthRoutes from './health.routes.js';

const router = express.Router();

// Health check endpoint
router.use('/health', healthRoutes);

// Future module routes to be mounted by the team:
// router.use('/auth', authRoutes);             // Dev 1 (GM-7)
// router.use('/members', memberRoutes);        // Dev 2 (GM-11)
// router.use('/plans', planRoutes);            // Dev 3 (GM-16)
// router.use('/subscriptions', subRoutes);     // Dev 3 (GM-17)
// router.use('/payments', paymentRoutes);      // Dev 4 (GM-21)
// router.use('/dashboard', dashboardRoutes);   // Dev 4 (GM-22)

export default router;
