import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { projectService } from '../services/projectService';
import { AppError } from '../middlewares/errorMiddleware';

// GET /api/projects
export const getProjects = async (
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

    const { search, archived, page, limit, sortBy } = req.query;

    const result = await projectService.findProjects({
      tenantId,
      userId,
      role,
      search: search as string,
      archived: archived === 'true',
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

// POST /api/projects
export const createProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next(new AppError('Tenant context missing', 400));

    const { name, description, memberIds } = req.body;

    if (!name) {
      return next(new AppError('Project name is required', 400));
    }

    const newProject = await projectService.createProject({
      tenantId,
      userId: req.user!.id,
      name,
      description,
      memberIds,
    });

    res.status(201).json({
      status: 'success',
      data: { project: newProject },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error creating project';
    const statusCode = msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission') ? 403 : msg.toLowerCase().includes('not found') ? 404 : 400;
    next(new AppError(msg, statusCode));
  }
};

// PUT /api/projects/:id
export const updateProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next(new AppError('Tenant context missing', 400));

    const { id } = req.params;
    const { name, description, memberIds } = req.body;

    const updatedProject = await projectService.updateProject({
      id,
      tenantId,
      userId: req.user!.id,
      name,
      description,
      memberIds,
    });

    res.status(200).json({
      status: 'success',
      data: { project: updatedProject },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error updating project';
    const statusCode = msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission') ? 403 : msg.toLowerCase().includes('not found') ? 404 : 400;
    next(new AppError(msg, statusCode));
  }
};

// DELETE /api/projects/:id
export const deleteProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next(new AppError('Tenant context missing', 400));

    const { id } = req.params;

    await projectService.deleteProject({ id, tenantId, userId: req.user!.id });

    res.status(200).json({
      status: 'success',
      message: 'Project deleted successfully',
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error deleting project';
    const statusCode = msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission') ? 403 : msg.toLowerCase().includes('not found') ? 404 : 400;
    next(new AppError(msg, statusCode));
  }
};

// PATCH /api/projects/:id/archive
export const archiveProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next(new AppError('Tenant context missing', 400));

    const { id } = req.params;

    const project = await projectService.setProjectArchived({
      id,
      tenantId,
      userId: req.user!.id,
      archived: true,
    });

    res.status(200).json({
      status: 'success',
      data: { project },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error archiving project';
    const statusCode = msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission') ? 403 : msg.toLowerCase().includes('not found') ? 404 : 400;
    next(new AppError(msg, statusCode));
  }
};

// PATCH /api/projects/:id/restore
export const restoreProject = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next(new AppError('Tenant context missing', 400));

    const { id } = req.params;

    const project = await projectService.setProjectArchived({
      id,
      tenantId,
      userId: req.user!.id,
      archived: false,
    });

    res.status(200).json({
      status: 'success',
      data: { project },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error restoring project';
    const statusCode = msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission') ? 403 : msg.toLowerCase().includes('not found') ? 404 : 400;
    next(new AppError(msg, statusCode));
  }
};
