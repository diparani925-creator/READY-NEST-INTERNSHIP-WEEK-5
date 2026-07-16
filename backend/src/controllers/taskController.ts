import { Request, Response, NextFunction } from 'express';
import { taskService } from '../services/taskService';
import { AppError } from '../middlewares/errorMiddleware';

const ALLOWED_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
const ALLOWED_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

// GET /api/tasks
export const getTasks = async (
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

    const {
      search,
      projectId,
      status,
      priority,
      assignedUserId,
      dueDate,
      page,
      limit,
      sortBy,
    } = req.query;

    // Validate parameters if provided
    if (status && !ALLOWED_STATUSES.includes(status as string)) {
      return next(new AppError('Invalid status query parameter', 400));
    }
    if (priority && !ALLOWED_PRIORITIES.includes(priority as string)) {
      return next(new AppError('Invalid priority query parameter', 400));
    }

    const result = await taskService.findTasks({
      tenantId,
      userId,
      role,
      search: search as string,
      projectId: projectId as string,
      status: status as string,
      priority: priority as string,
      assignedUserId: assignedUserId as string,
      dueDate: dueDate as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy: sortBy as any,
    });

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/tasks
export const createTask = async (
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

    const { title, description, projectId, assignedUserId, priority, dueDate, status } = req.body;

    if (!title || !projectId) {
      return next(new AppError('Title and projectId are required', 400));
    }

    if (status && !ALLOWED_STATUSES.includes(status)) {
      return next(new AppError(`Status must be one of: ${ALLOWED_STATUSES.join(', ')}`, 400));
    }

    if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
      return next(new AppError(`Priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}`, 400));
    }

    const newTask = await taskService.createTask({
      tenantId,
      userId,
      role,
      title,
      description,
      projectId,
      assignedUserId,
      priority,
      dueDate,
      status,
    });

    res.status(201).json({
      status: 'success',
      data: { task: newTask },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error creating task';
    const statusCode = msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission') ? 403 : msg.toLowerCase().includes('not found') ? 404 : 400;
    next(new AppError(msg, statusCode));
  }
};

// PUT /api/tasks/:id
export const updateTask = async (
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

    const { id } = req.params;
    const { title, description, assignedUserId, status, priority, dueDate, projectId } = req.body;

    if (status && !ALLOWED_STATUSES.includes(status)) {
      return next(new AppError(`Status must be one of: ${ALLOWED_STATUSES.join(', ')}`, 400));
    }

    if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
      return next(new AppError(`Priority must be one of: ${ALLOWED_PRIORITIES.join(', ')}`, 400));
    }

    const updatedTask = await taskService.updateTask({
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
    });

    res.status(200).json({
      status: 'success',
      data: { task: updatedTask },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error updating task';
    const statusCode = msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission') ? 403 : msg.toLowerCase().includes('not found') ? 404 : 400;
    next(new AppError(msg, statusCode));
  }
};

// DELETE /api/tasks/:id
export const deleteTask = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next(new AppError('Tenant context missing', 400));

    const { id } = req.params;

    await taskService.deleteTask({ id, tenantId, userId: req.user!.id });

    res.status(200).json({
      status: 'success',
      message: 'Task deleted successfully',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error deleting task';
    const statusCode = msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission') ? 403 : msg.toLowerCase().includes('not found') ? 404 : 400;
    next(new AppError(msg, statusCode));
  }
};
