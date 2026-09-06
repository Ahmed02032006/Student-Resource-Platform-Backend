import mongoose from 'mongoose';
import crypto from 'crypto';

const enrollmentRequestSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    courseId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Course',
      required: true,
    },
    // Cryptographically secure random identifier — never sequential or predictable
    uniqueKey: {
      type:    String,
      unique:  true,
    },
    status: {
      type:    String,
      enum:    ['pending', 'approved', 'rejected', 'revoked'],
      default: 'pending',
    },
    decidedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },
    decidedAt: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Compound unique index: a student can have at most one simultaneous
//    request per course (prevents duplicate pending/active enrollments) ─────────
enrollmentRequestSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// ── Pre-validate hook: generate uniqueKey automatically if not provided ────────
enrollmentRequestSchema.pre('validate', function (next) {
  if (!this.uniqueKey) {
    // 18 random bytes → 24 Base64URL chars (URL-safe, no padding issues)
    this.uniqueKey = crypto.randomBytes(18).toString('base64url');
  }
  next();
});

const EnrollmentRequest = mongoose.model('EnrollmentRequest', enrollmentRequestSchema);
export default EnrollmentRequest;
