import express from 'express';
import { authenticate } from '../Middleware/authenticate.js';
import { authorize } from '../Middleware/authorize.js';
import {
    getAssessments,
    createAssessment,
    updateAssessment,
    deleteAssessment,
} from '../Controllers/assessmentController.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Public (authenticated) read
router.get('/', getAssessments);

// CR / Admin only
router.post('/', authorize('cr', 'admin'), createAssessment);
router.patch('/:id', authorize('cr', 'admin'), updateAssessment);
router.delete('/:id', authorize('cr', 'admin'), deleteAssessment);

export default router;