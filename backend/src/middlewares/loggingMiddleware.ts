import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;
  const userAgent = req.headers['user-agent'] || 'unknown';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const message = `${method} ${originalUrl} - ${statusCode} - ${duration}ms`;

    if (statusCode >= 500) {
      logger.error(`[RequestError] ${message}`, { ip, userAgent });
    } else if (statusCode >= 400) {
      logger.warn(`[RequestWarning] ${message}`, { ip, userAgent });
    } else {
      logger.info(`[RequestSuccess] ${message}`, { ip, userAgent });
    }
  });

  next();
};
