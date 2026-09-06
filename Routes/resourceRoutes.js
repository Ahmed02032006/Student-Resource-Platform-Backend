import express from 'express';
import { getResourceAccess } from '../Controllers/resourceController.js';
import { authenticate } from '../Middleware/authenticate.js';

const router = express.Router();

/**
 * GET /api/resources/:id/access
 *
 * Enrollment check is special here: we need the courseId from the resource
 * document itself (not a URL param). The checkEnrollment middleware reads
 * req.params.id || req.params.courseId, so we resolve the courseId in-handler
 * via the controller, OR we use a lightweight inline resolver below.
 *
 * Approach: inline resolver injects req.params.courseId before the enrollment
 * gate runs, so no extra DB round-trip logic lives in the middleware.
 */
import Resource from '../Models/resourceModel.js';
import { checkEnrollment } from '../Middleware/checkEnrollment.js';

const resolveCourseId = async (req, res, next) => {
  try {
    const resource = await Resource.findById(req.params.id).select('courseId');
    if (!resource) {
      return res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Resource not found.' });
    }
    // Inject courseId so checkEnrollment can read req.params.courseId
    req.params.courseId = resource.courseId.toString();
    next();
  } catch (err) {
    next(err);
  }
};

// GET /api/resources/:id/access?download=true|false
router.get('/:id/access', authenticate, resolveCourseId, checkEnrollment, getResourceAccess);

export default router;
