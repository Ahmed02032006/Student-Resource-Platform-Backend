import mongoose from 'mongoose';

export const connectToDb = async () => {
  try {
    const connStr = process.env.CONNECTION_STRING || process.env.MONGO_URI;
    if (!connStr) {
      console.warn('MongoDB connection string missing in environment variables.');
      return;
    }
    const conn = await mongoose.connect(connStr);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Clean up legacy/stale index userEmail_1 if present from previous schema versions
    try {
      await mongoose.connection.collection('users').dropIndex('userEmail_1');
      console.log('🧹 Dropped legacy userEmail_1 index from users collection');
    } catch {
      // Index already dropped or does not exist — ignore
    }
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
  }
};
