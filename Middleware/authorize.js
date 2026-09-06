/**
 * Middleware factory: authorize(role)
 * Must run AFTER authenticate (requires req.user to be set).
 * Usage:  router.patch('/...', authenticate, authorize('admin'), handler)
 */
export const authorize = (role) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      code:   'NOT_AUTHENTICATED',
      message: 'You must be logged in to access this resource.',
    });
  }

  if (req.user.role !== role) {
    return res.status(403).json({
      status: 'error',
      code:   'FORBIDDEN',
      message: `Access denied. Required role: ${role}.`,
    });
  }

  next();
};
