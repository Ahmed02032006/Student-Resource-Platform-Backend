import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../Models/userModel.js';
import { logActivity } from '../Middleware/activityLogger.js';

// ── Helpers ────────────────────────────────────────────────────────────────────
const issueToken = (user) => {
  try {
    return jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '7d' }
    );
  } catch (err) {
    console.error('JWT Sign Error:', err);
    throw err;
  }
};

/** Generate a 10-char uppercase alphanumeric uniqueUserId */
const generateUniqueUserId = () =>
  crypto.randomBytes(6).toString('base64url').toUpperCase().slice(0, 10);

// ── POST /api/auth/login ───────────────────────────────────────────────────────
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'email and password are required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    // ── Account status gate ────────────────────────────────────────────────────
    if (user.accountStatus === 'pending') {
      return res.status(403).json({
        status: 'error',
        code: 'ACCOUNT_PENDING',
        message: 'Your account is awaiting administrator approval.',
      });
    }

    if (user.accountStatus === 'rejected') {
      return res.status(403).json({
        status: 'error',
        code: 'ACCOUNT_REJECTED',
        message: 'Your account registration was rejected.',
        rejectionInfo: user.rejectionInfo,
      });
    }

    // ── Approved — issue JWT ───────────────────────────────────────────────────
    const token = issueToken(user);

    // Capture the PREVIOUS login time before overwriting it, so the response
    // can tell the user "you last logged in at X" rather than the moment
    // that's about to happen right now.
    const previousLogin = user.lastLogin;
    const now = new Date();

    // Fire-and-forget-ish, but we still await it so the response reflects the
    // saved value reliably. updateOne() skips full document validation/hooks
    // (no re-hashing of passwordHash), so this adds negligible latency —
    // unlike calling user.save() here.
    User.updateOne({ _id: user._id }, { $set: { lastLogin: now } }).catch((err) =>
      console.error('⚠️ Failed to update lastLogin:', err)
    );

    // Log activity (fire and forget). Wrapped in try/catch rather than
    // chaining .catch() directly, since that throws synchronously (and was
    // the cause of a 500 here) if logActivity isn't guaranteed to return a
    // real Promise.
    try {
      await logActivity({
        userId: user._id,
        action: 'login',
        metadata: { email: user.email, ip: req.ip },
      });
    } catch (logErr) {
      console.error('⚠️ Activity log error:', logErr);
    }

    return res.status(200).json({
      status: 'success',
      token,
      data: {
        id: user._id,
        uniqueUserId: user.uniqueUserId,
        name: user.name,
        email: user.email,
        role: user.role,
        semester: user.semester,
        accountStatus: user.accountStatus,
        lastLogin: previousLogin, // the sign-in before this one
      },
    });
  } catch (err) {
    console.error('❌ Login error:', err);

    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again later.' : err.message,
      debug: process.env.NODE_ENV !== 'production' ? {
        error: err.message,
        stack: err.stack,
        name: err.name,
      } : undefined,
    });
  }
};

// ── POST /api/auth/register ────────────────────────────────────────────────────
export const register = async (req, res, next) => {
  try {
    const { name, email, password, semester } = req.body;

    if (!name || !email || !password || !semester) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'name, email, password, and semester are all required.',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Password must be at least 8 characters long.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        code: 'EMAIL_TAKEN',
        message: 'An account with this email address already exists.',
      });
    }

    // Build user — pre-save hook will bcrypt passwordHash
    const user = await User.create({
      uniqueUserId: generateUniqueUserId(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: password, // Hook hashes this before saving
      semester: semester.trim(),
      role: 'user',
      accountStatus: 'pending',
    });

    try {
      await logActivity({ userId: user._id, action: 'register', metadata: { email: user.email } });
    } catch (logErr) {
      console.error('⚠️ Activity log error:', logErr);
    }

    return res.status(201).json({
      status: 'success',
      message: 'Registration submitted. Your account is pending administrator approval.',
      data: {
        uniqueUserId: user.uniqueUserId,
        name: user.name,
        email: user.email,
        semester: user.semester,
        accountStatus: user.accountStatus,
      },
    });
  } catch (err) {
    console.error('❌ Registration error:', err);
    next(err);
  }
};

// ── GET /api/auth/me ────────────────────────────────────────────────────────────
export const getMe = async (req, res, next) => {
  try {
    const user = req.user;
    return res.status(200).json({
      status: 'success',
      data: {
        id: user._id,
        uniqueUserId: user.uniqueUserId,
        name: user.name,
        email: user.email,
        role: user.role,
        semester: user.semester,
        accountStatus: user.accountStatus,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    console.error('❌ GetMe error:', err);
    next(err);
  }
};