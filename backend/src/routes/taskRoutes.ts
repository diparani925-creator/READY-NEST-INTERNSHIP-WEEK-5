import { Router } from 'express';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/taskController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';
import { UserRole } from '@prisma/client';
import { validateBody, taskSchema } from '../middlewares/validationMiddleware';

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

// List, create, and update tasks are available to all authenticated users (subject to role constraints inside the controllers)
router.get('/', getTasks);
router.post('/', validateBody(taskSchema), createTask);
router.put('/:id', validateBody(taskSchema.partial()), updateTask);

// Delete tasks is restricted to OWNER and ADMIN only
router.delete('/:id', requireRole([UserRole.OWNER, UserRole.ADMIN]), deleteTask);

export default router;
