import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import authRoutes from './routes/authRoutes';
import projectRoutes from './routes/projectRoutes';
import taskRoutes from './routes/taskRoutes';
import memberRoutes from './routes/memberRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import notificationRoutes from './routes/notificationRoutes';
import uploadRoutes from './routes/uploadRoutes';
import { errorHandler } from './middlewares/errorMiddleware';
import { apiLimiter, authLimiter, sanitizeInput } from './middlewares/securityMiddleware';
import { loggingMiddleware } from './middlewares/loggingMiddleware';

const app = express();

// Apply logging middleware early to log all incoming requests
app.use(loggingMiddleware);

// Secure Express app by setting various HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows browser to render uploaded attachments
  })
);

// Strict CORS setup supporting comma-separated lists of domains
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : 'http://localhost:3000';

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

// Serve uploaded profile pictures and attachments statically
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Parse JSON request bodies
app.use(express.json());
app.use(cookieParser());

// Apply recursive XSS protection sanitizer
app.use(sanitizeInput);

// Apply general API rate limiter to all api paths
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', authLimiter, authRoutes); // Stricter limit on auth operations
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/uploads', uploadRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Centralized error handling
app.use(errorHandler);

export default app;
