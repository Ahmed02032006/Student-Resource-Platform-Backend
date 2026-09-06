import express from 'express';
import { listCourses, getCourse } from '../Controllers/courseController.js';
import { authenticate } from '../Middleware/authenticate.js';
import { checkEnrollment } from '../Middleware/checkEnrollment.js';
import { listCourseResources } from '../Controllers/resourceController.js';

const router = express.Router();

// GET /api/courses
router.get('/', authenticate, listCourses);

// GET /api/courses/:id
router.get('/:id', authenticate, getCourse);

// GET /api/courses/:id/resources — requires approved enrollment
router.get('/:id/resources', authenticate, checkEnrollment, listCourseResources);

export default router;
