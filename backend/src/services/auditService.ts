import prisma from '../config/db';
import { Request } from 'express';

export const auditService = {
  async logAction({
    tenantId,
    userId,
    action,
    details,
    req,
  }: {
    tenantId: string;
    userId?: string;
    action: string;
    details?: string;
    req?: Request;
  }) {
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    if (req) {
      // Safely check remote address
      ipAddress =
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        req.ip ||
        null;
      userAgent = req.headers['user-agent'] || null;
    }

    try {
      const log = await prisma.auditLog.create({
        data: {
          tenantId,
          userId: userId || null,
          action,
          details: details || null,
          ipAddress,
          userAgent,
        },
      });
      return log;
    } catch (err) {
      console.error('[AuditServiceError] Failed to write audit log:', err);
      return null;
    }
  },
};
export default auditService;
