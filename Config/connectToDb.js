import mongoose from 'mongoose';

/**
 * Serverless-safe connection cache.
 *
 * On Vercel (and other serverless platforms) this module can be reused
 * across invocations of a "warm" function instance, but a fresh
 * `mongoose.connect()` call on every request/cold-start is what was causing
 * the multi-second delay after login/register — each call opened a brand
 * new TCP+TLS handshake to Atlas from scratch.
 *
 * We cache the connection (and the in-flight connection promise) on
 * `global`, so:
 *  - a warm invocation reuses the existing connection instantly
 *  - concurrent requests during a cold start await the SAME promise instead
 *    of each kicking off its own separate `connect()` call
 */
let cached = global._mongooseCache;
if (!cached) {
  cached = global._mongooseCache = { conn: null, promise: null, indexCleaned: false };
}

export const connectToDb = async () => {
  // Already connected (warm invocation) — return immediately.
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // A connection attempt is already in flight — await the same one.
  if (!cached.promise) {
    const connStr = process.env.CONNECTION_STRING || process.env.MONGO_URI;
    if (!connStr) {
      throw new Error('MongoDB connection string missing in environment variables.');
    }

    cached.promise = mongoose
      .connect(connStr, {
        // Fail fast instead of silently buffering queries while disconnected
        bufferCommands: false,
        maxPoolSize: 10,
      })
      .then((mongooseInstance) => {
        console.log(`MongoDB Connected: ${mongooseInstance.connection.host}`);
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Reset so the next request can retry instead of being stuck on a dead promise
    cached.promise = null;
    console.error(`Error connecting to MongoDB: ${error.message}`);
    throw error;
  }

  // One-time legacy index cleanup — only needs to run once per warm container,
  // not on every single request.
  if (!cached.indexCleaned) {
    cached.indexCleaned = true;
    try {
      await cached.conn.connection.collection('users').dropIndex('userEmail_1');
      console.log('🧹 Dropped legacy userEmail_1 index from users collection');
    } catch {
      // Index already dropped or does not exist — ignore
    }
  }

  return cached.conn;
};