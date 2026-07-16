import { Prisma, UserRole } from '@prisma/client';
import prisma from '../config/db';
import { notificationService } from './notificationService';
import { broadcastToTenant } from '../config/socket';

interface FindTasksParams {
  tenantId: string;
  userId: string;
  role: UserRole;
  search?: string;
  projectId?: string;
  status?: string;
  priority?: string;
  assignedUserId?: string;
  dueDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'newest' | 'oldest' | 'priority' | 'dueDate';
}

export const taskService = {
  async findTasks({
    tenantId,
    userId,
    role,
    search,
    projectId,
    status,
    priority,
    assignedUserId,
    dueDate,
    page = 1,
    limit = 10,
    sortBy = 'newest',
  }: FindTasksParams) {
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Number(limit));
    const skip = (pageNum - 1) * limitNum;

    // Filter build
    const where: Prisma.TaskWhereInput = {
      project: {
        tenantId,
      },
    };

    // Scoped visibility: MEMBER sees only their assigned tasks
    if (role === UserRole.MEMBER) {
      where.assignedUserId = userId;
    } else if (assignedUserId) {
      where.assignedUserId = assignedUserId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
    }

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (dueDate) {
      const startOfDay = new Date(dueDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(dueDate);
      endOfDay.setUTCHours(23, 59, 59, 999);
      where.dueDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    // Sort mappings
    let orderBy: Prisma.TaskOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (sortBy === 'dueDate') {
      orderBy = { dueDate: 'asc' };
    } else if (sortBy === 'priority') {
      orderBy = { priority: 'desc' };
    }

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
        },
        orderBy,
        skip,
        take: limitNum,
      }),
    ]);

    return {
      tasks,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  },

  async createTask({
    tenantId,
    userId,
    role,
    title,
    description,
    projectId,
    assignedUserId,
    priority = 'MEDIUM',
    dueDate,
    status = 'TODO',
  }: {
    tenantId: string;
    userId: string;
    role: UserRole;
    title: string;
    description?: string;
    projectId: string;
    assignedUserId?: string;
    priority?: string;
    dueDate?: string;
    status?: string;
  }) {
    // Verify project belongs to tenant
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { select: { id: true } } },
    });

    if (!project || project.tenantId !== tenantId) {
      throw new Error('Project not found in your organization');
    }

    let targetAssignedUserId = assignedUserId;

    if (role === UserRole.MEMBER) {
      const isMember = project.members.some((m) => m.id === userId);
      if (!isMember) {
        throw new Error('Forbidden: You are not assigned to this project');
      }
      targetAssignedUserId = userId;
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId,
        creatorId: userId,
        assignedUserId: targetAssignedUserId || null,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    // 1. Log activity
    await notificationService.logActivity({
      tenantId,
      userId,
      type: 'TASK_CREATED',
      message: `Task "${task.title}" was added to project "${task.project.name}"`,
    });

    // 2. Notify assigned user (if assigned and not self)
    if (task.assignedUserId && task.assignedUserId !== userId) {
      await notificationService.createNotification({
        userId: task.assignedUserId,
        tenantId,
        title: 'New Task Assignment',
        message: `Task "${task.title}" has been assigned to you.`,
        type: 'TASK_ASSIGNED',
      });
    }

    // 3. Broadcast real-time change to all clients of this tenant
    broadcastToTenant(tenantId, 'TASK_CHANGE', { action: 'create', taskId: task.id });

    return task;
  },

  async updateTask({
    id,
    tenantId,
    userId,
    role,
    title,
    description,
    assignedUserId,
    status,
    priority,
    dueDate,
    projectId,
  }: {
    id: string;
    tenantId: string;
    userId: string;
    role: UserRole;
    title?: string;
    description?: string;
    assignedUserId?: string;
    status?: string;
    priority?: string;
    dueDate?: string | null;
    projectId?: string;
  }) {
    const prevTask = await prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!prevTask || prevTask.project.tenantId !== tenantId) {
      throw new Error('Task not found in your organization');
    }

    const updateData: Prisma.TaskUpdateInput = {};

    if (role === UserRole.MEMBER) {
      // MEMBER can only update their own task
      if (prevTask.assignedUserId !== userId) {
        throw new Error('Forbidden: You can only update tasks assigned to you');
      }

      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
    } else {
      // OWNER / ADMIN
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (status !== undefined) updateData.status = status;
      if (priority !== undefined) updateData.priority = priority;
      if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
      if (assignedUserId !== undefined) {
        updateData.assignedUser = assignedUserId
          ? { connect: { id: assignedUserId } }
          : { disconnect: true };
      }

      if (projectId !== undefined && projectId !== prevTask.projectId) {
        // Verify new project belongs to tenant
        const newProject = await prisma.project.findUnique({
          where: { id: projectId },
        });
        if (!newProject || newProject.tenantId !== tenantId) {
          throw new Error('Target project not found in your organization');
        }
        updateData.project = { connect: { id: projectId } };
      }
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    // 1. Log activity
    const isCompletedChange = status === 'DONE' && prevTask.status !== 'DONE';
    await notificationService.logActivity({
      tenantId,
      userId,
      type: isCompletedChange ? 'TASK_COMPLETED' : 'TASK_UPDATED',
      message: isCompletedChange
        ? `Task "${task.title}" was completed`
        : `Task "${task.title}" was updated`,
    });

    // 2. Notify newly assigned user
    if (
      task.assignedUserId &&
      task.assignedUserId !== prevTask.assignedUserId &&
      task.assignedUserId !== userId
    ) {
      await notificationService.createNotification({
        userId: task.assignedUserId,
        tenantId,
        title: 'New Task Assignment',
        message: `Task "${task.title}" has been assigned to you.`,
        type: 'TASK_ASSIGNED',
      });
    }

    // 3. Broadcast real-time change to all clients of this tenant
    broadcastToTenant(tenantId, 'TASK_CHANGE', { action: 'update', taskId: task.id });

    return task;
  },

  async deleteTask({ id, tenantId, userId }: { id: string; tenantId: string; userId: string }) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!task || task.project.tenantId !== tenantId) {
      throw new Error('Task not found in your organization');
    }

    const result = await prisma.task.delete({
      where: { id },
    });

    // 1. Log activity
    await notificationService.logActivity({
      tenantId,
      userId,
      type: 'TASK_DELETED',
      message: `Task "${task.title}" was deleted`,
    });

    // 2. Broadcast real-time change to all clients of this tenant
    broadcastToTenant(tenantId, 'TASK_CHANGE', { action: 'delete', taskId: id });

    return result;
  },
};
