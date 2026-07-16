import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import prisma from '../config/db';
import { AppError } from '../middlewares/errorMiddleware';
import { notificationService } from '../services/notificationService';
import { broadcastToTenant } from '../config/socket';
import auditService from '../services/auditService';

// GET /api/members - OWNER/ADMIN only
export const getMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next(new AppError('Tenant context missing', 400));

    const members = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({
      status: 'success',
      data: { members },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/members/invite - OWNER/ADMIN only
export const inviteMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    const inviterRole = req.user?.role;
    if (!tenantId) return next(new AppError('Tenant context missing', 400));

    const { email, password, name, role } = req.body;

    if (!email || !password || !name || !role) {
      return next(new AppError('All fields (email, password, name, role) are required', 400));
    }

    // Role validation
    if (!Object.values(UserRole).includes(role)) {
      return next(new AppError('Invalid user role specified', 400));
    }

    // ADMIN constraint
    if (inviterRole === UserRole.ADMIN && role === UserRole.OWNER) {
      return next(new AppError('ADMINs cannot invite or create an OWNER user', 403));
    }

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return next(new AppError('Email address already registered', 409));
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: role as UserRole,
        tenantId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Log Activity
    await notificationService.logActivity({
      tenantId,
      userId: req.user!.id,
      type: 'MEMBER_JOINED',
      message: `User "${newUser.name}" was invited to join the organization`,
    });

    // Broadcast change
    broadcastToTenant(tenantId, 'ROSTER_CHANGE', { action: 'join', memberId: newUser.id });

    res.status(201).json({
      status: 'success',
      data: { member: newUser },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/members/:id - OWNER only
export const removeMember = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    const currentUserId = req.user?.id;
    if (!tenantId) return next(new AppError('Tenant context missing', 400));

    const { id } = req.params;

    if (id === currentUserId) {
      return next(new AppError('You cannot remove yourself from the organization', 400));
    }

    // Find the user to remove
    const userToRemove = await prisma.user.findUnique({
      where: { id },
    });

    if (!userToRemove || userToRemove.tenantId !== tenantId) {
      return next(new AppError('Member not found in your organization', 404));
    }

    // Cannot remove another OWNER
    if (userToRemove.role === UserRole.OWNER) {
      return next(new AppError('OWNER users cannot be removed', 403));
    }

    await prisma.user.delete({
      where: { id },
    });

    // Log Activity
    await notificationService.logActivity({
      tenantId,
      userId: req.user!.id,
      type: 'MEMBER_LEFT',
      message: `User "${userToRemove.name}" was removed from the organization`,
    });

    // Broadcast change
    broadcastToTenant(tenantId, 'ROSTER_CHANGE', { action: 'leave', memberId: id });

    res.status(200).json({
      status: 'success',
      message: 'Member removed successfully',
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/members/:id/role - OWNER only
export const updateMemberRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    const currentUserId = req.user?.id;
    if (!tenantId) return next(new AppError('Tenant context missing', 400));

    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return next(new AppError('Role is required', 400));
    }

    if (!Object.values(UserRole).includes(role)) {
      return next(new AppError('Invalid role specified', 400));
    }

    if (id === currentUserId) {
      return next(new AppError('You cannot change your own role', 400));
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser || targetUser.tenantId !== tenantId) {
      return next(new AppError('Member not found in your organization', 404));
    }

    // OWNER checks
    if (targetUser.role === UserRole.OWNER) {
      return next(new AppError('The OWNER role configuration cannot be changed', 403));
    }

    if (role === UserRole.OWNER) {
      return next(new AppError('You cannot promote another user to OWNER role', 403));
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: role as UserRole },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // Log Activity
    await notificationService.logActivity({
      tenantId,
      userId: req.user!.id,
      type: 'MEMBER_ROLE_CHANGED',
      message: `User "${targetUser.name}" role updated to ${role}`,
    });

    // Broadcast change
    broadcastToTenant(tenantId, 'ROSTER_CHANGE', { action: 'role', memberId: id, role });

    // Log Audit Log
    await auditService.logAction({
      tenantId,
      userId: req.user!.id,
      action: 'ROLE_CHANGE',
      details: `Role of member "${targetUser.name}" (${targetUser.email}) updated from ${targetUser.role} to ${role}`,
      req,
    });

    res.status(200).json({
      status: 'success',
      data: { member: updatedUser },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/organization - OWNER only
export const deleteOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next(new AppError('Tenant context missing', 400));

    // Delete the entire tenant (cascades to users, refresh tokens, projects, and tasks)
    await prisma.tenant.delete({
      where: { id: tenantId },
    });

    // Clear cookies as the session is destroyed
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    res.status(200).json({
      status: 'success',
      message: 'Organization and all associated data deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
