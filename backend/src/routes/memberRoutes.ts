import { Router } from 'express';
import {
  getMembers,
  inviteMember,
  removeMember,
  updateMemberRole,
  deleteOrganization,
} from '../controllers/memberController';
import { authenticate, requireRole } from '../middlewares/authMiddleware';
import { UserRole } from '@prisma/client';

import { validateBody, inviteMemberSchema } from '../middlewares/validationMiddleware';

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

// View members - allowed for all authenticated users
router.get('/', getMembers);
router.post('/invite', requireRole([UserRole.OWNER, UserRole.ADMIN]), validateBody(inviteMemberSchema), inviteMember);

// OWNER only paths
router.delete('/:id', requireRole([UserRole.OWNER]), removeMember);
router.put('/:id/role', requireRole([UserRole.OWNER]), updateMemberRole);
router.delete('/organization/delete', requireRole([UserRole.OWNER]), deleteOrganization);

export default router;
