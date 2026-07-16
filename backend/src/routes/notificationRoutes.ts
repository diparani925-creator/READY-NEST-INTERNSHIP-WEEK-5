import { Router } from 'express';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notificationController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

router.get('/', getNotifications);
router.put('/read-all', markAllNotificationsAsRead);
router.put('/:id/read', markNotificationAsRead);

export default router;
