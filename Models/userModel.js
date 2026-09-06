import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const rejectionInfoSchema = new mongoose.Schema(
  {
    reason:      { type: String, default: null },
    canReapply:  { type: Boolean, default: false },
    rejectedAt:  { type: Date, default: null },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    uniqueUserId: {
      type:     String,
      required: true,
      unique:   true,
      trim:     true,
    },
    name: {
      type:     String,
      required: true,
      trim:     true,
    },
    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    passwordHash: {
      type:     String,
      required: true,
    },
    role: {
      type:    String,
      enum:    ['user', 'admin', 'cr'],
      default: 'user',
    },
    semester: {
      type: String,
      trim: true,
    },
    accountStatus: {
      type:    String,
      enum:    ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionInfo: {
      type:    rejectionInfoSchema,
      default: () => ({}),
    },
  },
  { timestamps: true }
);

// ── Pre-save hook: hash plain-text password before persisting ──────────────────
userSchema.pre('save', async function (next) {
  // Only re-hash when the passwordHash field is actually modified
  if (!this.isModified('passwordHash')) return next();

  try {
    const salt       = await bcrypt.genSalt(12);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Instance method: compare a plain-text password with the stored hash ────────
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

const User = mongoose.model('User', userSchema);
export default User;
