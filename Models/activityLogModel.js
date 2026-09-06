import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Allow null for unauthenticated events (e.g. failed logins)
    },
    action: {
      type: String,
      enum: [
        'login',
        'logout',
        'register',
        'enrollment_request',
        'resource_view',
        'resource_download',
        'admin_approve',
        'admin_reject',
        'admin_revoke',
        'admin_delete_course',
        'admin_update_user',
        'admin_delete_user',
        'create_assessment',
      ],
      required: true,
    },
    // Flexible payload: courseId, resourceId, ip, user-agent, etc.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true, // Index: fast time-range queries and audit log sorting
    },
  },
  {
    // No automatic createdAt/updatedAt — timestamp field serves that purpose
    timestamps: false,
  }
);

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
