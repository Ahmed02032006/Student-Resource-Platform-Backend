import Assessment from '../Models/assessmentModel.js';
import Course from '../Models/courseModel.js';
import { logActivity } from '../Middleware/activityLogger.js';

// ── GET /api/assessments ────────────────────────────────────────────────────
// Query params: ?courseId=...&upcoming=true&limit=...
export const getAssessments = async (req, res, next) => {
  try {
    const { courseId, upcoming, limit = 10 } = req.query;
    const filter = {};

    if (courseId) filter.courseId = courseId;
    if (upcoming === 'true') {
      filter.scheduledAt = { $gte: new Date() };
    }

    const assessments = await Assessment.find(filter)
      .populate('courseId', 'courseCode courseName')
      .populate('postedBy', 'name email')
      .sort({ scheduledAt: 1 })
      .limit(Number(limit));

    return res.status(200).json({
      status: 'success',
      count: assessments.length,
      data: assessments,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/assessments ───────────────────────────────────────────────────
// Only CR or Admin
export const createAssessment = async (req, res, next) => {
  try {
    const { title, description, courseId, scheduledAt, type } = req.body;

    if (!title || !courseId || !scheduledAt) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'title, courseId, and scheduledAt are required.',
      });
    }

    // Verify course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Course not found.',
      });
    }

    const assessment = await Assessment.create({
      title: title.trim(),
      description: description?.trim() || '',
      courseId,
      scheduledAt: new Date(scheduledAt),
      type: type || 'other',
      postedBy: req.user._id,
    });

    // Log activity
    logActivity({
      userId: req.user._id,
      action: 'create_assessment',
      metadata: {
        assessmentId: assessment._id,
        courseId,
        title: assessment.title,
      },
    });

    return res.status(201).json({
      status: 'success',
      data: assessment,
    });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/assessments/:id ─────────────────────────────────────────────
// Only creator or admin can update
export const updateAssessment = async (req, res, next) => {
  try {
    const { title, description, scheduledAt, type } = req.body;

    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Assessment not found.',
      });
    }

    // Authorization: only the creator or admin
    if (req.user.role !== 'admin' && assessment.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message: 'You are not allowed to update this assessment.',
      });
    }

    if (title) assessment.title = title.trim();
    if (description !== undefined) assessment.description = description.trim();
    if (scheduledAt) assessment.scheduledAt = new Date(scheduledAt);
    if (type) assessment.type = type;

    await assessment.save();

    return res.status(200).json({
      status: 'success',
      data: assessment,
    });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/assessments/:id ─────────────────────────────────────────────
// Only creator or admin
export const deleteAssessment = async (req, res, next) => {
  try {
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Assessment not found.',
      });
    }

    if (req.user.role !== 'admin' && assessment.postedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        status: 'error',
        code: 'FORBIDDEN',
        message: 'You are not allowed to delete this assessment.',
      });
    }

    await assessment.deleteOne();

    return res.status(200).json({
      status: 'success',
      message: 'Assessment deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};