import { Request, Response, NextFunction } from 'express';
import prisma from '../config/db';
import { AppError } from '../middlewares/errorMiddleware';
import { UserRole } from '@prisma/client';

// GET /api/dashboard/stats
export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;
    const role = req.user?.role;

    if (!tenantId || !userId || !role) {
      return next(new AppError('Unauthorized context', 401));
    }

    // Build task scoping where filter
    const taskWhere: any = {
      project: {
        tenantId,
      },
    };
    if (role === UserRole.MEMBER) {
      taskWhere.assignedUserId = userId;
    }

    const projectWhere: any = {
      tenantId,
    };
    if (role === UserRole.MEMBER) {
      projectWhere.members = {
        some: { id: userId },
      };
    }

    // 1. Projects statistics
    const [totalProjects, archivedProjects] = await Promise.all([
      prisma.project.count({ where: projectWhere }),
      prisma.project.count({ where: { ...projectWhere, archived: true } }),
    ]);
    const activeProjects = totalProjects - archivedProjects;

    // 2. Tasks statistics
    const tasks = await prisma.task.findMany({
      where: taskWhere,
      select: {
        status: true,
        priority: true,
      },
    });

    const statusCounts = { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 };
    const priorityCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };

    tasks.forEach((t) => {
      const statusKey = t.status as keyof typeof statusCounts;
      const priorityKey = t.priority as keyof typeof priorityCounts;
      
      if (statusKey in statusCounts) {
        statusCounts[statusKey]++;
      }
      if (priorityKey in priorityCounts) {
        priorityCounts[priorityKey]++;
      }
    });

    const totalTasks = tasks.length;
    const completedTasks = statusCounts.DONE;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 3. Recent Activities (fetch from ActivityLog table)
    const logs = await prisma.activityLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const activities = logs.map((log) => ({
      id: log.id,
      type: log.type,
      message: log.message,
      time: log.createdAt,
    }));

    res.status(200).json({
      status: 'success',
      data: {
        projects: {
          total: totalProjects,
          active: activeProjects,
          archived: archivedProjects,
        },
        tasks: {
          total: totalTasks,
          statusCounts,
          priorityCounts,
        },
        progressPercentage,
        recentActivities: activities,
      },
    });
  } catch (error) {
    next(error);
  }
};
