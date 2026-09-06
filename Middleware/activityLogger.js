import ActivityLog from '../Models/activityLogModel.js';

/**
 * Fire-and-forget activity logger.
 * Does NOT block the response — errors are swallowed and logged to stderr only.
 *
 * Usage (inside a controller, after sending the response):
 *   logActivity({ userId, action, metadata });
 *
 * Or use the Express middleware factory for route-level logging:
 *   router.get('/', authenticate, activityLogger('resource_view'), handler);
 */
export const logActivity = ({ userId = null, action, metadata = {} }) => {
  // Intentionally not awaited — fire and forget
  ActivityLog.create({ userId, action, metadata, timestamp: new Date() }).catch((err) => {
    console.error('[ActivityLog] Failed to write log entry:', err.message);
  });
};

/**
 * Express middleware factory for declarative route-level logging.
 * Logs AFTER the response is sent using the 'finish' event so it never
 * delays the client.
 *
 * Usage:
 *   router.get('/path', authenticate, activityLogger('login'), handler);
 */
export const activityLogger = (action, metadataFn = null) => (req, res, next) => {
  res.on('finish', () => {
    // Only log successful / meaningful responses
    if (res.statusCode >= 500) return;

    const metadata = metadataFn ? metadataFn(req, res) : {
      ip:        req.ip,
      userAgent: req.get('user-agent'),
      path:      req.originalUrl,
    };

    logActivity({
      userId:   req.user?._id ?? null,
      action,
      metadata,
    });
  });

  next();
};
