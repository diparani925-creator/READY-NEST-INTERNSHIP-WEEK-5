import { Router } from 'express';
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  archiveProject,
  restoreProject,
} from '../controllers/projectController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';
import { UserRole } from '@prisma/client';
import { validateBody, projectSchema } from '../middlewares/validationMiddleware';

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

// View projects - allowed for all authenticated users
router.get('/', getProjects);

// Write paths - restricted to OWNER and ADMIN
router.post('/', requireRole([UserRole.OWNER, UserRole.ADMIN]), validateBody(projectSchema), createProject);
router.put('/:id', requireRole([UserRole.OWNER, UserRole.ADMIN]), validateBody(projectSchema.partial()), updateProject);
router.delete('/:id', requireRole([UserRole.OWNER, UserRole.ADMIN]), deleteProject);

// Archive & Restore paths - OWNER and ADMIN
router.patch('/:id/archive', requireRole([UserRole.OWNER, UserRole.ADMIN]), archiveProject);
router.patch('/:id/restore', requireRole([UserRole.OWNER, UserRole.ADMIN]), restoreProject);

export default router;
