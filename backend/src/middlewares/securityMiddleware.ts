import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Rate Limiter for Authentication requests (register/login/refresh)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 'fail',
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  },
});

// General API Rate Limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'fail',
    message: 'Too many API requests from this IP, please try again after 15 minutes',
  },
});

// HTML escaping helper to prevent Cross-Site Scripting (XSS)
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Recursive input sanitization for request payloads
const sanitizeValue = (value: any): any => {
  if (typeof value === 'string') {
    return escapeHtml(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        cleaned[key] = sanitizeValue(value[key]);
      }
    }
    return cleaned;
  }
  return value;
};

// Middleware to clean req.body, req.query, and req.params recursively
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};
