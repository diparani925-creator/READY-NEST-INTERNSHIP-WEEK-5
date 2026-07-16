import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorMiddleware';
import { UserRole } from '@prisma/client';

interface JwtPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = req.cookies?.access_token;

  if (!token) {
    return next(new AppError('Authentication token missing', 401));
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-change-in-production'
    ) as JwtPayload;

    req.user = decoded;
    req.tenantId = decoded.tenantId;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Authentication token has expired', 401));
    }
    return next(new AppError('Invalid authentication token', 401));
  }
};

export const requireRole = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Unauthenticated request', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: Insufficient privileges', 403));
    }

    next();
  };
};
