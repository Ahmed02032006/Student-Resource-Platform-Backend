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
  console.log('🔐 Login attempt received');
  console.log('Request body:', req.body);
  
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'email and password are required.',
      });
    }

    console.log('🔍 Looking for user with email:', email);
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    console.log('✅ User found:', user.email);
    console.log('🔐 Checking password...');

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      console.log('❌ Password mismatch for user:', email);
      return res.status(401).json({
        status: 'error',
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    console.log('✅ Password matched');

    // ── Account status gate ────────────────────────────────────────────────────
    if (user.accountStatus === 'pending') {
      console.log('⏳ Account pending for user:', email);
      return res.status(403).json({
        status: 'error',
        code: 'ACCOUNT_PENDING',
        message: 'Your account is awaiting administrator approval.',
      });
    }

    if (user.accountStatus === 'rejected') {
      console.log('❌ Account rejected for user:', email);
      return res.status(403).json({
        status: 'error',
        code: 'ACCOUNT_REJECTED',
        message: 'Your account registration was rejected.',
        rejectionInfo: user.rejectionInfo,
      });
    }

    // ── Approved — issue JWT ───────────────────────────────────────────────────
    console.log('🔑 Issuing token for user:', email);
    const token = issueToken(user);

    // Log activity (fire and forget)
    try {
      await logActivity({
        userId: user._id,
        action: 'login',
        metadata: { email: user.email, ip: req.ip },
      });
    } catch (logErr) {
      console.error('Activity log error:', logErr);
    }

    console.log('✅ Login successful for user:', email);

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
      },
    });
  } catch (err) {
    console.error('❌ Login error details:', err);
    console.error('❌ Error stack:', err.stack);
    
    // Send detailed error for debugging
    return res.status(500).json({
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong. Please try again later.' : err.message,
      debug: process.env.NODE_ENV !== 'production' ? {
        error: err.message,
        stack: err.stack,
        name: err.name
      } : undefined
    });
  }
};

// ── POST /api/auth/register ────────────────────────────────────────────────────
export const register = async (req, res, next) => {
  console.log('📝 Registration attempt received');
  
  try {
    const { name, email, password, semester } = req.body;

    // Basic validation
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

    logActivity({ userId: user._id, action: 'register', metadata: { email: user.email } });

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
    console.error('❌ Registration error details:', err);
    console.error('❌ Error stack:', err.stack);
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
      },
    });
  } catch (err) {
    console.error('❌ GetMe error:', err);
    next(err);
  }
};