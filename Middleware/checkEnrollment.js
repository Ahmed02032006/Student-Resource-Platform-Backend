import EnrollmentRequest from '../Models/enrollmentRequestModel.js';

/**
 * Middleware: checkEnrollment
 * Verifies the authenticated user has an APPROVED enrollment for the course.
 * If the user is an admin, access is automatically granted.
 *
 * Must run AFTER authenticate.
 * Used on: GET /api/courses/:id/resources  and  GET /api/resources/:id/access
 */
export const checkEnrollment = async (req, res, next) => {
  try {
    // Admin role bypasses enrollment check
    if (req.user?.role === 'admin') {
      return next();
    }

    // Support both route param shapes: req.params.courseId (injected on resource access route)
    // or req.params.id (on course routes). req.params.courseId MUST take precedence over req.params.id.
    const courseId = req.params.courseId || req.params.id;

    if (!courseId) {
      return res.status(400).json({
        status:  'error',
        code:    'MISSING_COURSE_ID',
        message: 'courseId parameter is required.',
      });
    }

    const enrollment = await EnrollmentRequest.findOne({
      userId:   req.user._id,
      courseId,
      status:   'approved',
    });

    if (!enrollment) {
      return res.status(403).json({
        status:  'error',
        code:    'NOT_ENROLLED',
        message: 'You do not have approved enrollment for this course.',
      });
    }

    // Attach for downstream use (e.g. logging)
    req.enrollment = enrollment;
    next();
  } catch (err) {
    next(err);
  }
};
