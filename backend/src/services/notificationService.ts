import prisma from '../config/db';
import { broadcastToTenant } from '../config/socket';

export const notificationService = {
  async createNotification({
    userId,
    tenantId,
    title,
    message,
    type,
  }: {
    userId: string;
    tenantId: string;
    title: string;
    message: string;
    type?: string;
  }) {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
      },
    });

    // Broadcast notification event to tenant room
    broadcastToTenant(tenantId, 'NEW_NOTIFICATION', {
      notification,
      userId, // Used by clients to filter notifications belonging to them
    });

    return notification;
  },

  async logActivity({
    tenantId,
    userId,
    type,
    message,
  }: {
    tenantId: string;
    userId?: string;
    type: string;
    message: string;
  }) {
    const log = await prisma.activityLog.create({
      data: {
        tenantId,
        userId,
        type,
        message,
      },
      include: {
        user: { select: { name: true } },
      },
    });

    // Broadcast activity event to tenant room
    broadcastToTenant(tenantId, 'NEW_ACTIVITY', log);

    // Also trigger stats refresh request event
    broadcastToTenant(tenantId, 'STATS_REFRESH', {});

    return log;
  },

  async getUserNotifications(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  async markAsRead(id: string, userId: string) {
    return prisma.notification.update({
      where: { id, userId },
      data: { read: true },
    });
  },

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  },
};
