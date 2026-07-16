import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Schema for registration inputs
export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().min(2, 'Name must be at least 2 characters long').max(50),
  tenantName: z.string().min(2, 'Organization name must be at least 2 characters long'),
  tenantSlug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and dashes'),
});

// Schema for login inputs
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// Schema for project CRUD inputs
export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().optional().nullable(),
  memberIds: z.array(z.string().uuid('Invalid member ID format')).optional(),
});

// Schema for task CRUD inputs
export const taskSchema = z.object({
  title: z.string().min(1, 'Task title is required').max(200),
  description: z.string().optional().nullable(),
  projectId: z.string().uuid('Invalid project ID format'),
  assignedUserId: z.string().uuid('Invalid assigned user ID format').optional().nullable(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  dueDate: z.string().optional().nullable(),
});

// Schema for inviting a member
export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['ADMIN', 'MEMBER']),
});

// Zod validation runner middleware
export const validateBody = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await schema.safeParseAsync(req.body);
      if (!result.success) {
        res.status(400).json({
          status: 'fail',
          message: 'Validation error',
          errors: result.error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }
      req.body = result.data;
      next();
    } catch (err) {
      next(err);
    }
  };
};
