import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { connectToDb } from './Config/connectToDb.js';
import authRoutes from './Routes/authRoutes.js';
import courseRoutes from './Routes/courseRoutes.js';
import enrollmentRoutes from './Routes/enrollmentRoutes.js';
import resourceRoutes from './Routes/resourceRoutes.js';
import adminRoutes from './Routes/adminRoutes.js';
import assessmentRoutes from './Routes/assessmentRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Database connection ────────────────────────────────────────────────────────
// IMPORTANT: this MUST run before any route that touches the DB (i.e. all of
// them). It previously lived in a middleware registered AFTER the 404
// handler below, which meant it never actually ran for a matched route —
// Express had already sent a response before reaching it. The connection
// itself is cached (see connectToDb.js) so on a warm serverless instance
// this resolves instantly instead of reconnecting every request.
app.use(async (_req, res, next) => {
  try {
    await connectToDb();
    next();
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    return res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNAVAILABLE',
      message: 'Database service temporarily unavailable. Please try again in a moment.',
    });
  }
});

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.status(200).json({
    status: 'success',
    message: 'Course Resource Hub API — Phase 3',
    timestamp: new Date().toISOString(),
  })
);

app.get('/', (req, res) => {
  res.json({ message: `Server is running! || On This Url ${process.env.FRONTEND_URL}` });
});

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/assessments', assessmentRoutes);

// ── 404 handler ────────────────────────────────────────────────────────────────
// Must come AFTER every real route, or it swallows requests meant for them.
app.use((_req, res) =>
  res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Endpoint not found.' })
);

// ── Global error handler ───────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Error]', err);

  if (err.name === 'CastError') {
    return res.status(400).json({ status: 'error', code: 'INVALID_ID', message: 'Invalid ID format.' });
  }
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message).join('; ');
    return res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: messages });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const fieldName = (field === 'userEmail' || field === 'email') ? 'email address' : field;
    return res.status(409).json({ status: 'error', code: 'DUPLICATE_KEY', message: `An account with this ${fieldName} already exists.` });
  }

  return res.status(err.status || 500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message,
  });
});

// ── Start ──────────────────────────────────────────────────────────────────────
// Kick off a connection eagerly for local/non-serverless dev so the first
// request doesn't pay the connection cost. On Vercel this line still runs
// once per cold start, but the per-request middleware above is what
// actually guarantees the connection is ready — and it reuses this same
// cached promise instead of opening a second connection.
connectToDb();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`ENV: ${process.env.NODE_ENV || 'development'}`);
});

export default app;