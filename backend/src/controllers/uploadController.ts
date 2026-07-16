import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../config/db';
import { AppError } from '../middlewares/errorMiddleware';
import auditService from '../services/auditService';

// helper to delete uploaded file from disk on validation failure
const cleanDiskFile = (filePath: string) => {
  const absolutePath = path.join(process.cwd(), filePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
};

// POST /api/uploads/profile
export const uploadProfileImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!userId || !tenantId) return next(new AppError('Unauthorized access', 401));

    if (!req.file) {
      return next(new AppError('No file uploaded or file rejected by validations', 400));
    }

    const relativePath = `/uploads/${req.file.filename}`;

    // Update user profile picture in DB
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileImage: relativePath },
      select: { id: true, name: true, email: true, role: true, profileImage: true },
    });

    // Write audit event log
    await auditService.logAction({
      tenantId,
      userId,
      action: 'FILE_UPLOAD',
      details: `User uploaded a new profile image: ${req.file.originalname}`,
      req,
    });

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser },
    });
  } catch (error) {
    if (req.file) cleanDiskFile(`uploads/${req.file.filename}`);
    next(error);
  }
};

// POST /api/uploads/attachment
export const uploadAttachment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!userId || !tenantId) return next(new AppError('Unauthorized access', 401));

    if (!req.file) {
      return next(new AppError('No file uploaded or file rejected by validations', 400));
    }

    const { projectId, taskId } = req.body;
    const relativePath = `/uploads/${req.file.filename}`;

    if (!projectId && !taskId) {
      cleanDiskFile(`uploads/${req.file.filename}`);
      return next(new AppError('Attachment must be linked to either a projectId or a taskId', 400));
    }

    // Tenant boundary checks
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, tenantId },
      });
      if (!project) {
        cleanDiskFile(`uploads/${req.file.filename}`);
        return next(new AppError('Linked project not found in this organization', 404));
      }
    }

    if (taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          project: { tenantId },
        },
      });
      if (!task) {
        cleanDiskFile(`uploads/${req.file.filename}`);
        return next(new AppError('Linked task not found in this organization', 404));
      }
    }

    // Save attachment details to DB
    const attachment = await prisma.attachment.create({
      data: {
        filename: req.file.originalname,
        path: relativePath,
        mimeType: req.file.mimetype,
        size: req.file.size,
        tenantId,
        userId,
        projectId: projectId || null,
        taskId: taskId || null,
      },
    });

    // Write audit event log
    await auditService.logAction({
      tenantId,
      userId,
      action: 'FILE_UPLOAD',
      details: `Uploaded attachment "${req.file.originalname}" (${req.file.size} bytes) for ${
        projectId ? `project ${projectId}` : `task ${taskId}`
      }`,
      req,
    });

    res.status(201).json({
      status: 'success',
      data: { attachment },
    });
  } catch (error) {
    if (req.file) cleanDiskFile(`uploads/${req.file.filename}`);
    next(error);
  }
};

// GET /api/uploads/attachments
export const getAttachments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next(new AppError('Unauthorized access', 401));

    const { projectId, taskId } = req.query;

    if (!projectId && !taskId) {
      return next(new AppError('Must query by projectId or taskId', 400));
    }

    const where: any = { tenantId };
    if (projectId) where.projectId = projectId as string;
    if (taskId) where.taskId = taskId as string;

    const attachments = await prisma.attachment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(200).json({
      status: 'success',
      data: { attachments },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/uploads/attachments/:id
export const deleteAttachment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId;
    if (!userId || !tenantId) return next(new AppError('Unauthorized access', 401));

    const { id } = req.params;

    // Find the record
    const attachment = await prisma.attachment.findFirst({
      where: { id, tenantId },
    });

    if (!attachment) {
      return next(new AppError('Attachment not found in your organization', 404));
    }

    // Delete physical file from disk
    cleanDiskFile(attachment.path.substring(1)); // Remove leading slash

    // Delete record from DB
    await prisma.attachment.delete({
      where: { id },
    });

    // Write audit event log
    await auditService.logAction({
      tenantId,
      userId,
      action: 'FILE_DELETE',
      details: `Deleted attachment file: "${attachment.filename}"`,
      req,
    });

    res.status(200).json({
      status: 'success',
      message: 'Attachment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
