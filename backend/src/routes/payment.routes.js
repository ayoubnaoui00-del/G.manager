import express from 'express';
import {
  createPayment,
  getPaymentById,
  getPayments,
} from '../controllers/payment.controller.js';
// import authMiddleware from '../middlewares/authMiddleware.js'; // waiting for Dev 1 (GM-7)

const router = express.Router();

// router.use(authMiddleware); // waiting for Dev 1 (GM-7)
router.get('/', getPayments);
router.get('/:id', getPaymentById);
router.post('/', createPayment);

export default router;
