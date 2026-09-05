import mongoose from 'mongoose';

// Cache connection across serverless invocations (Vercel best practice)
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 8000,
    };

    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongooseInstance) => {
      console.log('MongoDB Connected to cluster');
      return mongooseInstance;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('MongoDB Connection Error:', e.message);
    throw e;
  }

  return cached.conn;
};
