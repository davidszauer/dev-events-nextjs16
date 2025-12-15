import mongoose from 'mongoose';

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
const globalForMongoose = global as unknown as {
  mongoose: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

/**
 * Cached connection object to store the mongoose connection and promise
 * This ensures we only create one connection per instance
 */
if (!globalForMongoose.mongoose) {
  globalForMongoose.mongoose = { conn: null, promise: null };
}

/**
 * MongoDB connection string from environment variables
 * Falls back to a default local connection string if not provided
 */
const MONGODB_URI: string = process.env.MONGODB_URI || 'mongodb://localhost:27017/nextjs_course';

/**
 * Establishes a connection to MongoDB using Mongoose
 * Uses connection caching to prevent multiple connections during development
 * 
 * @returns {Promise<typeof mongoose>} A promise that resolves to the mongoose instance
 * @throws {Error} If MONGODB_URI is not provided or connection fails
 */
async function connectDB(): Promise<typeof mongoose> {
  // If we already have a cached connection, return it immediately
  if (globalForMongoose.mongoose.conn) {
    return globalForMongoose.mongoose.conn;
  }

  // If we don't have a connection promise, create one
  if (!globalForMongoose.mongoose.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false, // Disable mongoose buffering
    };

    // Create the connection promise
    globalForMongoose.mongoose.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        // Connection successful
        console.log('✅ MongoDB connected successfully');
        return mongooseInstance;
      })
      .catch((error: Error) => {
        // Connection failed - clear the promise so we can retry
        globalForMongoose.mongoose.promise = null;
        console.error('❌ MongoDB connection error:', error);
        throw error;
      });
  }

  // Wait for the connection promise to resolve
  try {
    globalForMongoose.mongoose.conn = await globalForMongoose.mongoose.promise;
  } catch (error) {
    // If connection fails, clear the cached promise
    globalForMongoose.mongoose.promise = null;
    throw error;
  }

  return globalForMongoose.mongoose.conn;
}

/**
 * Closes the MongoDB connection
 * Useful for cleanup in tests or when shutting down the application
 * 
 * @returns {Promise<void>} A promise that resolves when the connection is closed
 */
async function disconnectDB(): Promise<void> {
  if (globalForMongoose.mongoose.conn) {
    await mongoose.disconnect();
    globalForMongoose.mongoose.conn = null;
    globalForMongoose.mongoose.promise = null;
    console.log('🔌 MongoDB disconnected');
  }
}

export { connectDB, disconnectDB };
export default connectDB;
