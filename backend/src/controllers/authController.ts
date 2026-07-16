import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import prisma from '../config/db';
import { AppError } from '../middlewares/errorMiddleware';
import auditService from '../services/auditService';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

const generateAccessToken = (payload: object): string => {
  return jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-change-in-production',
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

const generateRefreshToken = (payload: object): string => {
  return jwt.sign(
    { ...payload, jti: Math.random().toString(36).substring(2) + Date.now().toString(36) },
    process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-token-key-change-in-production',
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
};

const setTokenCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string
): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
  });
};

const clearTokenCookies = (res: Response): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie('access_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });

  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/api/auth',
  });
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, name, tenantName, tenantSlug } = req.body;

    if (!email || !password || !name || !tenantName || !tenantSlug) {
      return next(new AppError('All registration fields are required', 400));
    }

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return next(new AppError('Email address already registered', 409));
    }

    // Check if tenant slug is already taken
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug.toLowerCase().trim() },
    });

    if (existingTenant) {
      return next(new AppError('Tenant slug already taken', 409));
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Database transaction: create tenant and owner user
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          slug: tenantSlug.toLowerCase().trim(),
        },
      });

      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
          role: UserRole.OWNER,
          tenantId: tenant.id,
        },
      });

      return { tenant, user };
    });

    const tokenPayload = {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
      tenantId: result.tenant.id,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ id: result.user.id });

    // Store refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: result.user.id,
        expiresAt,
      },
    });

    setTokenCookies(res, accessToken, refreshToken);

    await auditService.logAction({
      tenantId: result.tenant.id,
      userId: result.user.id,
      action: 'REGISTER',
      details: `User "${result.user.name}" (${result.user.email}) registered and created organization "${result.tenant.name}".`,
      req,
    });

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          tenant: {
            id: result.tenant.id,
            name: result.tenant.name,
            slug: result.tenant.slug,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Email and password are required', 400));
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return next(new AppError('Invalid email or password', 401));
    }

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken({ id: user.id });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    setTokenCookies(res, accessToken, refreshToken);

    await auditService.logAction({
      tenantId: user.tenantId,
      userId: user.id,
      action: 'LOGIN',
      details: `User "${user.name}" (${user.email}) logged in successfully.`,
      req,
    });

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    const token = req.cookies?.access_token;

    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_ACCESS_SECRET || 'super-secret-access-token-key-change-in-production'
        ) as any;
        if (decoded) {
          await auditService.logAction({
            tenantId: decoded.tenantId,
            userId: decoded.id,
            action: 'LOGOUT',
            details: `User "${decoded.name}" logged out successfully.`,
            req,
          });
        }
      } catch (err) {
        // Ignore token verification errors during logout
      }
    }

    if (refreshToken) {
      // Remove token from database to prevent replay attacks
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    clearTokenCookies(res);

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const oldRefreshToken = req.cookies?.refresh_token;

    if (!oldRefreshToken) {
      return next(new AppError('Refresh token missing', 401));
    }

    let decoded: any;
    try {
      decoded = jwt.verify(
        oldRefreshToken,
        process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-token-key-change-in-production'
      );
    } catch (err) {
      return next(new AppError('Invalid or expired refresh token', 401));
    }

    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: oldRefreshToken },
    });

    if (!tokenRecord || tokenRecord.revoked || tokenRecord.expiresAt < new Date()) {
      // If refresh token is invalid/expired/revoked, clear tokens
      if (tokenRecord) {
        await prisma.refreshToken.delete({ where: { id: tokenRecord.id } });
      }
      clearTokenCookies(res);
      return next(new AppError('Session expired. Please log in again.', 401));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { tenant: true },
    });

    if (!user) {
      clearTokenCookies(res);
      return next(new AppError('User session not found', 401));
    }

    // Refresh token rotation: delete old refresh token and generate new ones
    await prisma.refreshToken.delete({
      where: { id: tokenRecord.id },
    });

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken({ id: user.id });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    setTokenCookies(res, newAccessToken, newRefreshToken);

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const me = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { tenant: true },
    });

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
