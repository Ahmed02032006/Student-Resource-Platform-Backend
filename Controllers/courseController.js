import Course from '../Models/courseModel.js';

// ── GET /api/courses ───────────────────────────────────────────────────────────
export const listCourses = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.semesterId) {
      filter.semesterId = req.query.semesterId;
    }

    const courses = await Course.find(filter)
      .populate('semesterId', 'name isActive')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: 'success',
      count:  courses.length,
      data:   courses,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/courses/:id ───────────────────────────────────────────────────────
export const getCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('semesterId', 'name isActive')
      .populate('createdBy', 'name email');

    if (!course) {
      return res.status(404).json({
        status:  'error',
        code:    'NOT_FOUND',
        message: 'Course not found.',
      });
    }

    return res.status(200).json({ status: 'success', data: course });
  } catch (err) {
    next(err);
  }
};
