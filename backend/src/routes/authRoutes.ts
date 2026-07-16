import { Router } from 'express';
import { register, login, logout, refresh, me } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';
import { validateBody, registerSchema, loginSchema } from '../middlewares/validationMiddleware';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', authenticate, me);

export default router;
