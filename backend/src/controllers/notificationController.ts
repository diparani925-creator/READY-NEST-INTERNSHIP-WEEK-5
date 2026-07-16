import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notificationService';
import { AppError } from '../middlewares/errorMiddleware';

// GET /api/notifications
export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new AppError('User context missing', 401));

    const notifications = await notificationService.getUserNotifications(userId);

    res.status(200).json({
      status: 'success',
      data: { notifications },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/notifications/:id/read
export const markNotificationAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new AppError('User context missing', 401));

    const { id } = req.params;

    const notification = await notificationService.markAsRead(id, userId);

    res.status(200).json({
      status: 'success',
      data: { notification },
    });
  } catch (error) {
    next(new AppError(error instanceof Error ? error.message : 'Error updating notification', 400));
  }
};

// PUT /api/notifications/read-all
export const markAllNotificationsAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return next(new AppError('User context missing', 401));

    await notificationService.markAllAsRead(userId);

    res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};
