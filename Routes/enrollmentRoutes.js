import express from 'express';
import { requestEnrollment, getMyEnrollments } from '../Controllers/enrollmentController.js';
import { authenticate } from '../Middleware/authenticate.js';

const router = express.Router();

// POST /api/enrollments
router.post('/', authenticate, requestEnrollment);

// GET /api/enrollments/me
router.get('/me', authenticate, getMyEnrollments);

export default router;
