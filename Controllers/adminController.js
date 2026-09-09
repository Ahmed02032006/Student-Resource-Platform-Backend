import { v2 as cloudinary } from 'cloudinary';
import mongoose from 'mongoose';
import User from '../Models/userModel.js';
import Course from '../Models/courseModel.js';
import EnrollmentRequest from '../Models/enrollmentRequestModel.js';
import Resource from '../Models/resourceModel.js';
import Semester from '../Models/semesterModel.js';
import ActivityLog from '../Models/activityLogModel.js';


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── GET /api/admin/accounts?status=pending ────────────────────────────────────
export const getAccounts = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.accountStatus = req.query.status;
    
    if (req.query.role) filter.role = req.query.role;

    const users = await User.find(filter)
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    return res.status(200).json({ status: 'success', count: users.length, data: users });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/accounts/:id ─────────────────────────────────────────────
// action body: { action: 'approve' | 'reject', reason?, canReapply? }
export const updateAccount = async (req, res, next) => {
  try {
    const { action, reason, canReapply } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'action must be "approve" or "reject".',
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'User not found.' });
    }

    if (action === 'approve') {
      user.accountStatus = 'approved';
      user.rejectionInfo = { reason: null, canReapply: false, rejectedAt: null };
    } else {
      if (!reason) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'reason is required when rejecting an account.',
        });
      }
      user.accountStatus = 'rejected';
      user.rejectionInfo = {
        reason,
        canReapply: canReapply ?? false,
        rejectedAt: new Date(),
      };
    }

    await user.save();

    const logAction = action === 'approve' ? 'admin_approve' : 'admin_reject';
    ActivityLog.create({
      userId: req.user._id,
      action: logAction,
      metadata: { targetUserId: user._id, email: user.email, action },
      timestamp: new Date(),
    }).catch(() => { });

    return res.status(200).json({
      status: 'success',
      message: `Account ${action}d successfully.`,
      data: { id: user._id, accountStatus: user.accountStatus, rejectionInfo: user.rejectionInfo },
    });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/users/:id - Update user details ──────────────────────────
export const updateUserDetails = async (req, res, next) => {
  try {
    const { name, email, semester, uniqueUserId, accountStatus } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'User not found.' });
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return res.status(400).json({
          status: 'error',
          code: 'DUPLICATE_EMAIL',
          message: 'Email is already in use by another user.',
        });
      }
    }

    // Check if uniqueUserId is already taken
    if (uniqueUserId && uniqueUserId !== user.uniqueUserId) {
      const existingUserId = await User.findOne({ uniqueUserId, _id: { $ne: user._id } });
      if (existingUserId) {
        return res.status(400).json({
          status: 'error',
          code: 'DUPLICATE_USER_ID',
          message: 'User ID is already in use.',
        });
      }
    }

    // Update fields
    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (semester) user.semester = semester;
    if (uniqueUserId) user.uniqueUserId = uniqueUserId.trim();

    // Update accountStatus if provided
    if (accountStatus) {
      if (!['pending', 'approved', 'rejected'].includes(accountStatus)) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'accountStatus must be one of: pending, approved, rejected.',
        });
      }
      user.accountStatus = accountStatus;

      // If approved, clear rejection info
      if (accountStatus === 'approved') {
        user.rejectionInfo = { reason: null, canReapply: false, rejectedAt: null };
      }

      // If rejected, set rejection info
      if (accountStatus === 'rejected') {
        user.rejectionInfo = {
          reason: 'Rejected by admin',
          canReapply: false,
          rejectedAt: new Date(),
        };
      }
    }

    await user.save();

    // Log the update
    ActivityLog.create({
      userId: req.user._id,
      action: 'admin_update_user',
      metadata: {
        targetUserId: user._id,
        email: user.email,
        name: user.name,
        accountStatus: user.accountStatus
      },
      timestamp: new Date(),
    }).catch(() => { });

    return res.status(200).json({
      status: 'success',
      message: 'User updated successfully.',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        semester: user.semester,
        uniqueUserId: user.uniqueUserId,
        accountStatus: user.accountStatus
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/admin/users/:id - Delete user ─────────────────────────────────
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'User not found.' });
    }

    // Delete associated enrollment requests
    await EnrollmentRequest.deleteMany({ userId: user._id });

    // Delete the user
    await User.findByIdAndDelete(user._id);

    // Log the deletion
    ActivityLog.create({
      userId: req.user._id,
      action: 'admin_delete_user',
      metadata: { targetUserId: user._id, email: user.email, name: user.name },
      timestamp: new Date(),
    }).catch(() => { });

    return res.status(200).json({
      status: 'success',
      message: 'User deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/enrollments?status=pending ─────────────────────────────────
export const getEnrollments = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const enrollments = await EnrollmentRequest.find(filter)
      .populate('userId', 'name email uniqueUserId semester')
      .populate('courseId', 'courseCode courseName')
      .sort({ createdAt: -1 });

    return res.status(200).json({ status: 'success', count: enrollments.length, data: enrollments });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/enrollments/:id ──────────────────────────────────────────
export const updateEnrollment = async (req, res, next) => {
  try {
    const { action, reason } = req.body;

    if (!['approve', 'reject', 'revoke'].includes(action)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'action must be "approve", "reject", or "revoke".',
      });
    }

    const enrollment = await EnrollmentRequest.findById(req.params.id);
    if (!enrollment) {
      return res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Enrollment not found.' });
    }

    const statusMap = { approve: 'approved', reject: 'rejected', revoke: 'revoked' };
    enrollment.status = statusMap[action];
    enrollment.decidedBy = req.user._id;
    enrollment.decidedAt = new Date();
    await enrollment.save();

    const logActionMap = { approve: 'admin_approve', reject: 'admin_reject', revoke: 'admin_revoke' };
    ActivityLog.create({
      userId: req.user._id,
      action: logActionMap[action],
      metadata: { enrollmentId: enrollment._id, targetUserId: enrollment.userId, courseId: enrollment.courseId, reason },
      timestamp: new Date(),
    }).catch(() => { });

    return res.status(200).json({
      status: 'success',
      message: `Enrollment ${action}d successfully.`,
      data: enrollment,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/admin/courses ────────────────────────────────────────────────────
export const createCourse = async (req, res, next) => {
  try {
    let { courseId, courseCode, courseName, semesterId, semester } = req.body;

    if (!courseId || !courseCode || !courseName) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'courseId, courseCode, and courseName are required.',
      });
    }

    if (!semesterId || !mongoose.isValidObjectId(semesterId)) {
      const semName = semester || '1st Semester';
      let semDoc = await Semester.findOne({ name: semName });
      if (!semDoc) {
        semDoc = await Semester.create({ name: semName, isActive: true });
      }
      semesterId = semDoc._id;
    }

    const course = await Course.create({
      courseId: courseId.trim(),
      courseCode: courseCode.trim(),
      courseName: courseName.trim(),
      semesterId,
      createdBy: req.user._id,
    });

    return res.status(201).json({ status: 'success', data: course });
  } catch (err) {
    next(err);
  }
};

// ── PATCH /api/admin/courses/:id ────────────────────────────────────────────────
export const updateCourse = async (req, res, next) => {
  try {
    const { courseId, courseCode, courseName, semesterId, semester } = req.body;

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Course not found.' });
    }

    if (courseId) course.courseId = courseId.trim();
    if (courseCode) course.courseCode = courseCode.trim();
    if (courseName) course.courseName = courseName.trim();

    if (semesterId && mongoose.isValidObjectId(semesterId)) {
      course.semesterId = semesterId;
    } else if (semester) {
      let semDoc = await Semester.findOne({ name: semester });
      if (!semDoc) {
        semDoc = await Semester.create({ name: semester, isActive: true });
      }
      course.semesterId = semDoc._id;
    }

    await course.save();

    return res.status(200).json({
      status: 'success',
      message: 'Course updated successfully.',
      data: course,
    });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/admin/courses/:id ───────────────────────────────────────────────
export const deleteCourse = async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Course not found.' });
    }

    await Resource.deleteMany({ courseId: course._id });
    await EnrollmentRequest.deleteMany({ courseId: course._id });
    await Course.findByIdAndDelete(course._id);

    ActivityLog.create({
      userId: req.user._id,
      action: 'admin_delete_course',
      metadata: { courseId: course._id, courseCode: course.courseCode, courseName: course.courseName },
      timestamp: new Date(),
    }).catch(() => { });

    return res.status(200).json({
      status: 'success',
      message: 'Course deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/admin/courses/:id/resources ─────────────────────────────────────
export const addResource = async (req, res, next) => {
  try {
    const { title, type, cloudinaryPublicId, cloudinaryUrl } = req.body;

    if (!title || !type || !cloudinaryPublicId || !cloudinaryUrl) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'title, type, cloudinaryPublicId, and cloudinaryUrl are required.',
      });
    }

    const validTypes = ['pdf', 'video', 'image', 'note'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: `type must be one of: ${validTypes.join(', ')}.`,
      });
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Course not found.' });
    }

    const resource = await Resource.create({
      courseId: req.params.id,
      title: title.trim(),
      type,
      cloudinaryPublicId: cloudinaryPublicId.trim(),
      cloudinaryUrl: cloudinaryUrl.trim(),
      uploadedBy: req.user._id,
    });

    return res.status(201).json({ status: 'success', data: resource });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/admin/courses/:id/upload-signature ────────────────────────────────
export const getUploadSignature = async (req, res, next) => {
  try {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = `course-resources/${req.params.id}`;

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder, type: 'authenticated' },
      process.env.CLOUDINARY_API_SECRET
    );

    return res.status(200).json({
      status: 'success',
      data: {
        signature,
        timestamp,
        folder,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/activity ──────────────────────────────────────────────────────────
export const getActivityLog = async (req, res, next) => {
  try {
    const { userId, courseId, action, page = 1, limit = 20 } = req.query;

    const filter = {};

    if (req.user.role !== 'admin') {
      filter.userId = req.user._id;
    } else {
      if (userId && mongoose.isValidObjectId(userId)) {
        filter.userId = userId;
      }
    }

    if (action) filter.action = action;
    if (courseId && mongoose.isValidObjectId(courseId)) filter['metadata.courseId'] = courseId;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await ActivityLog.countDocuments(filter);
    const logs = await ActivityLog.find(filter)
      .populate('userId', 'name email uniqueUserId')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({
      status: 'success',
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
      data: logs,
    });
  } catch (err) {
    next(err);
  }
};