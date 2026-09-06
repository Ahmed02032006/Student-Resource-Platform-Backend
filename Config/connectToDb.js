import mongoose from 'mongoose';

// Cache the connection
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectToDb = async () => {
  // If we already have a connection, return it
  if (cached.conn) {
    return cached.conn;
  }

  // If we don't have a connection promise, create one
  if (!cached.promise) {
    const connStr = process.env.CONNECTION_STRING || process.env.MONGO_URI;
    
    if (!connStr) {
      console.error('❌ MongoDB connection string missing in environment variables.');
      throw new Error('MongoDB connection string is required');
    }

    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
      retryWrites: true,
      retryReads: true,
    };

    console.log('🔄 Connecting to MongoDB...');
    
    cached.promise = mongoose.connect(connStr, opts)
      .then((mongoose) => {
        console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
        return mongoose;
      })
      .catch((err) => {
        console.error(`❌ Error connecting to MongoDB: ${err.message}`);
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

export const isDbConnected = () => {
  return mongoose.connection.readyState === 1;
};