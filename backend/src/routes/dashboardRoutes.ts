import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Protect stats with authentication
router.get('/stats', authenticate, getDashboardStats);

export default router;
