import { Prisma, UserRole } from '@prisma/client';
import prisma from '../config/db';
import { notificationService } from './notificationService';
import { broadcastToTenant } from '../config/socket';
import auditService from './auditService';

interface FindProjectsParams {
  tenantId: string;
  userId: string;
  role: UserRole;
  search?: string;
  archived?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'alphabetical';
}

export const projectService = {
  async findProjects({
    tenantId,
    userId,
    role,
    search,
    archived = false,
    page = 1,
    limit = 10,
    sortBy = 'newest',
  }: FindProjectsParams) {
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    // Build Prisma query filter
    const where: Prisma.ProjectWhereInput = {
      tenantId,
      archived,
    };

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Role-based visibility scoping
    if (role === UserRole.MEMBER) {
      where.members = {
        some: { id: userId },
      };
    }

    // Sorting
    let orderBy: Prisma.ProjectOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sortBy === 'alphabetical') {
      orderBy = { name: 'asc' };
    }

    // Optimized queries: run count and data queries in parallel
    const [total, projects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        include: {
          members: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy,
        skip,
        take: limitNum,
      }),
    ]);

    return {
      projects,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  },

  async createProject({
    tenantId,
    userId,
    name,
    description,
    memberIds,
  }: {
    tenantId: string;
    userId: string;
    name: string;
    description?: string;
    memberIds?: string[];
  }) {
    const connectMembers = Array.isArray(memberIds)
      ? memberIds.map((id) => ({ id }))
      : [];

    const project = await prisma.project.create({
      data: {
        name,
        description,
        tenantId,
        members: {
          connect: connectMembers,
        },
      },
      include: {
        members: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // 1. Log activity
    await notificationService.logActivity({
      tenantId,
      userId,
      type: 'PROJECT_CREATED',
      message: `Project "${project.name}" was created`,
    });

    // 2. Notify assigned members
    if (Array.isArray(memberIds)) {
      for (const mId of memberIds) {
        if (mId !== userId) {
          await notificationService.createNotification({
            userId: mId,
            tenantId,
            title: 'Added to Project',
            message: `You were added to project "${project.name}"`,
            type: 'PROJECT_ASSIGNED',
          });
        }
      }
    }

    // 3. Broadcast real-time change to all clients of this tenant
    broadcastToTenant(tenantId, 'PROJECT_CHANGE', { action: 'create', projectId: project.id });

    return project;
  },

  async updateProject({
    id,
    tenantId,
    userId,
    name,
    description,
    memberIds,
  }: {
    id: string;
    tenantId: string;
    userId: string;
    name?: string;
    description?: string;
    memberIds?: string[];
  }) {
    const updateData: Prisma.ProjectUpdateInput = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    // Fetch previous members to determine newly added members
    const oldProject = await prisma.project.findUnique({
      where: { id, tenantId },
      include: { members: { select: { id: true } } },
    });

    if (!oldProject) {
      throw new Error('Project not found');
    }

    if (Array.isArray(memberIds)) {
      // Disconnect all previous members first to perform a clean update
      await prisma.project.update({
        where: { id, tenantId },
        data: {
          members: {
            set: [],
          },
        },
      });
      updateData.members = {
        connect: memberIds.map((memberId) => ({ id: memberId })),
      };
    }

    const project = await prisma.project.update({
      where: { id, tenantId },
      data: updateData,
      include: {
        members: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // 1. Log activity
    await notificationService.logActivity({
      tenantId,
      userId,
      type: 'PROJECT_UPDATED',
      message: `Project "${project.name}" details were updated`,
    });

    // 2. Notify newly added members
    if (Array.isArray(memberIds)) {
      const oldIds = oldProject.members.map((m) => m.id);
      for (const mId of memberIds) {
        if (!oldIds.includes(mId) && mId !== userId) {
          await notificationService.createNotification({
            userId: mId,
            tenantId,
            title: 'Added to Project',
            message: `You were added to project "${project.name}"`,
            type: 'PROJECT_ASSIGNED',
          });
        }
      }
    }

    // 3. Broadcast real-time change to all clients of this tenant
    broadcastToTenant(tenantId, 'PROJECT_CHANGE', { action: 'update', projectId: project.id });

    return project;
  },

  async deleteProject({ id, tenantId, userId }: { id: string; tenantId: string; userId: string }) {
    const project = await prisma.project.findUnique({
      where: { id, tenantId },
    });

    if (!project) throw new Error('Project not found');

    const result = await prisma.project.delete({
      where: { id, tenantId },
    });

    // 1. Log activity
    await notificationService.logActivity({
      tenantId,
      userId,
      type: 'PROJECT_DELETED',
      message: `Project "${project.name}" was deleted`,
    });

    // 1.2 Log audit log
    await auditService.logAction({
      tenantId,
      userId,
      action: 'PROJECT_DELETE',
      details: `Project "${project.name}" (ID: ${project.id}) was permanently deleted.`,
    });

    // 2. Broadcast real-time change to all clients of this tenant
    broadcastToTenant(tenantId, 'PROJECT_CHANGE', { action: 'delete', projectId: id });

    return result;
  },

  async setProjectArchived({
    id,
    tenantId,
    userId,
    archived,
  }: {
    id: string;
    tenantId: string;
    userId: string;
    archived: boolean;
  }) {
    const project = await prisma.project.update({
      where: { id, tenantId },
      data: { archived },
      include: {
        members: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // 1. Log activity
    await notificationService.logActivity({
      tenantId,
      userId,
      type: archived ? 'PROJECT_ARCHIVED' : 'PROJECT_RESTORED',
      message: `Project "${project.name}" was ${archived ? 'archived' : 'restored'}`,
    });

    // 2. Broadcast real-time change to all clients of this tenant
    broadcastToTenant(tenantId, 'PROJECT_CHANGE', { action: archived ? 'archive' : 'restore', projectId: id });

    return project;
  },
};
