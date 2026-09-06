import jwt from 'jsonwebtoken';
import User from '../Models/userModel.js';

/**
 * Middleware: authenticate
 * Verifies a Bearer JWT from the Authorization header.
 * On success, attaches the full user document to req.user.
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        code:   'NO_TOKEN',
        message: 'Authentication token is missing. Please log in.',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    } catch (err) {
      const code    = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
      const message = err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Invalid authentication token.';

      return res.status(401).json({ status: 'error', code, message });
    }

    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({
        status: 'error',
        code:   'USER_NOT_FOUND',
        message: 'The user associated with this token no longer exists.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};
