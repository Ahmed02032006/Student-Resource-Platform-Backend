import mongoose from 'mongoose';

// Cache the connection
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectToDb = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const connStr = process.env.CONNECTION_STRING || process.env.MONGO_URI;
    
    if (!connStr) {
      console.warn('MongoDB connection string missing in environment variables.');
      return null;
    }

    const opts = {
      bufferCommands: false,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 10000, // Keep trying to send operations for 10 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      retryReads: true,
    };

    cached.promise = mongoose.connect(connStr, opts).then((mongoose) => {
      console.log(`MongoDB Connected: ${mongoose.connection.host}`);
      
      // Clean up legacy index (only once)
      try {
        mongoose.connection.collection('users').dropIndex('userEmail_1').catch(() => {});
      } catch {
        // Index already dropped or does not exist — ignore
      }
      
      return mongoose;
    }).catch((err) => {
      console.error(`Error connecting to MongoDB: ${err.message}`);
      cached.promise = null;
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
  }
};

// Helper to check if connection is healthy
export const isDbConnected = () => {
  return mongoose.connection.readyState === 1;
};