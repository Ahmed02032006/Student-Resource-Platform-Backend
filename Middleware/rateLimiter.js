/**
 * In-memory sliding-window rate limiter (no external Redis dependency for Phase 3).
 * Keyed by IP address. For production, swap with redis-backed express-rate-limit.
 *
 * Usage:
 *   import { authRateLimiter } from '../Middleware/rateLimiter.js';
 *   router.post('/register', authRateLimiter, handler);
 */

const store = new Map(); // ip -> [timestamps]

const WINDOW_MS  = 15 * 60 * 1000; // 15 minutes
const MAX_HITS   = 20;              // max requests per window per IP (generous for Postman testing)

const cleanup = (timestamps, now) =>
  timestamps.filter((ts) => now - ts < WINDOW_MS);

export const authRateLimiter = (req, res, next) => {
  const ip  = req.ip;
  const now = Date.now();

  const hits = cleanup(store.get(ip) || [], now);
  hits.push(now);
  store.set(ip, hits);

  if (hits.length > MAX_HITS) {
    const retryAfterSec = Math.ceil(WINDOW_MS / 1000);
    res.set('Retry-After', retryAfterSec);
    return res.status(429).json({
      status:  'error',
      code:    'RATE_LIMITED',
      message: `Too many requests. Try again in ${retryAfterSec / 60} minutes.`,
    });
  }

  next();
};
