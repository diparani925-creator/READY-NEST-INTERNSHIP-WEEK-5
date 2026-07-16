import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorMiddleware';
import prisma from '../config/db';

export const checkTenant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const tenantId = req.tenantId || (req.headers['x-tenant-id'] as string);

  if (!tenantId) {
    return next(new AppError('Tenant context identifier missing', 400));
  }

  if (req.user && req.user.tenantId !== tenantId) {
    return next(new AppError('Unauthorized: Access denied to this tenant workspace', 403));
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return next(new AppError('Tenant not found or inactive', 404));
    }

    req.tenantId = tenantId;
    next();
  } catch (error) {
    next(error);
  }
};
