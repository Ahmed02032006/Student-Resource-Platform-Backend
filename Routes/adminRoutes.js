import express from 'express';
import { authenticate } from '../Middleware/authenticate.js';
import { authorize }    from '../Middleware/authorize.js';
import {
  getAccounts,
  updateAccount,
  updateUserDetails,
  deleteUser,
  getEnrollments,
  updateEnrollment,
  createCourse,
  updateCourse,
  deleteCourse,
  addResource,
  getUploadSignature,
  getActivityLog,
} from '../Controllers/adminController.js';

const router = express.Router();

// ── Apply authenticate to ALL routes ─────────────────────────────────────────
router.use(authenticate);

// ── Admin-only routes ────────────────────────────────────────────────────────

// Account management
router.get('/accounts', authorize('admin'), getAccounts);
router.patch('/accounts/:id', authorize('admin'), updateAccount);
router.patch('/users/:id', authorize('admin'), updateUserDetails);
router.delete('/users/:id', authorize('admin'), deleteUser);

// Enrollment management
router.get('/enrollments', authorize('admin'), getEnrollments);
router.patch('/enrollments/:id', authorize('admin'), updateEnrollment);

// Course management
router.post('/courses', authorize('admin'), createCourse);
router.patch('/courses/:id', authorize('admin'), updateCourse);
router.delete('/courses/:id', authorize('admin'), deleteCourse);
router.post('/courses/:id/resources', authorize('admin'), addResource);
router.get('/courses/:id/upload-signature', authorize('admin'), getUploadSignature);

// Activity log accessible by both admin and user
router.get('/activity', getActivityLog);

export default router;