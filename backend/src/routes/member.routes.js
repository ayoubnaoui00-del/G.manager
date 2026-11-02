import express from 'express';
import {
  getMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
} from '../controllers/member.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

// All member endpoints are protected by authMiddleware
router.use(authMiddleware);

router
  .route('/')
  .get(getMembers)
  .post(createMember);

router
  .route('/:id')
  .get(getMemberById)
  .put(updateMember)
  .delete(deleteMember);

export default router;
