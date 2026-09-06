import express from 'express';
import { register, login, getMe } from '../Controllers/authController.js';
import { authRateLimiter } from '../Middleware/rateLimiter.js';
import { authenticate } from '../Middleware/authenticate.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', authRateLimiter, register);

// POST /api/auth/login
router.post('/login', authRateLimiter, login);

// GET /api/auth/me
router.get('/me', authenticate, getMe);

export default router;

