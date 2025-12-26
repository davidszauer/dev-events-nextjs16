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
 * Checks if a string is already URL-encoded
 * URL-encoded strings contain % followed by two hex digits
 * 
 * @param str - String to check
 * @returns true if string appears to be URL-encoded
 */
function isAlreadyEncoded(str: string): boolean {
  // Check if string contains URL-encoded patterns (%XX where X is hex digit)
  return /%[0-9A-Fa-f]{2}/.test(str);
}

/**
 * Encodes username and password in MongoDB URI to handle special characters
 * Special characters like @, :, /, ?, #, %, &, =, +, and spaces need URL encoding
 * Only encodes if credentials are not already encoded to avoid double-encoding
 * 
 * @param uri - The MongoDB connection URI
 * @returns URI with properly encoded credentials
 */
function encodeMongoURICredentials(uri: string): string {
  // Don't skip encoding just because URI contains some encoded chars
  // We need to check credentials specifically, not the whole URI
  
  // Extract protocol (mongodb:// or mongodb+srv://)
  const protocolMatch = uri.match(/^(mongodb(?:\+srv)?:\/\/)/);
  if (!protocolMatch) {
    return uri; // Not a MongoDB URI, return as-is
  }
  
  const protocol = protocolMatch[1];
  const afterProtocol = uri.slice(protocol.length);
  
  // Find the @ symbol that separates credentials from host
  // In MongoDB URIs, the format is: protocol//username:password@host/path
  const atIndex = afterProtocol.indexOf('@');
  
  // If no @ found, there are no credentials to encode
  if (atIndex === -1) {
    return uri;
  }
  
  // Split into credentials part and host/path part
  const credentialsPart = afterProtocol.slice(0, atIndex);
  const hostAndPath = afterProtocol.slice(atIndex + 1);
  
  // Split credentials into username and password
  const colonIndex = credentialsPart.indexOf(':');
  
  if (colonIndex === -1) {
    // Only username, no password
    const encodedUsername = isAlreadyEncoded(credentialsPart) 
      ? credentialsPart 
      : encodeURIComponent(credentialsPart);
    return `${protocol}${encodedUsername}@${hostAndPath}`;
  }
  
  const username = credentialsPart.slice(0, colonIndex);
  const password = credentialsPart.slice(colonIndex + 1);
  
  // Check if credentials are already encoded
  // If the password contains %XX patterns, it's likely already encoded
  // But we need to be careful - some passwords might legitimately contain %
  const usernameEncoded = isAlreadyEncoded(username);
  const passwordEncoded = isAlreadyEncoded(password);
  
  // Only encode if not already encoded
  const encodedUsername = usernameEncoded 
    ? username 
    : encodeURIComponent(username);
  const encodedPassword = passwordEncoded 
    ? password 
    : encodeURIComponent(password);
  
  // Reconstruct URI with encoded credentials
  return `${protocol}${encodedUsername}:${encodedPassword}@${hostAndPath}`;
}

/**
 * Normalizes MongoDB URI by encoding credentials and removing port from mongodb+srv:// URIs
 * - Encodes username and password to handle special characters
 * - Removes port numbers from mongodb+srv:// URIs (not supported)
 * 
 * @param uri - The MongoDB connection URI
 * @returns Normalized URI with encoded credentials and no port for mongodb+srv://
 */
function normalizeMongoURI(uri: string): string {
  // First, encode credentials to handle special characters in username/password
  // This must happen before port removal to ensure proper parsing
  let normalized = encodeMongoURICredentials(uri);
  
  // If using mongodb+srv://, remove any port number
  if (normalized.startsWith('mongodb+srv://')) {
    // Remove port number pattern :<digits> that appears after @host and before /path
    // Example: mongodb+srv://user:pass@host:27017/db -> mongodb+srv://user:pass@host/db
    // Pattern matches: @hostname:port/ or @hostname:port? or @hostname:port
    normalized = normalized.replace(/(mongodb\+srv:\/\/[^@]+@[^:\/]+):\d+(\/|\?|$)/, '$1$2');
  }
  
  return normalized;
}

/**
 * MongoDB connection string from environment variables
 * Falls back to a default local connection string if not provided
 * Automatically normalizes mongodb+srv:// URIs to remove port numbers
 * 
 * Note: In development, you can log the normalized URI (without password) for debugging:
 * const uriForLogging = MONGODB_URI.replace(/:([^:@]+)@/, ':****@');
 */
const MONGODB_URI: string = (() => {
  const rawUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/nextjs_course';
  
  // Log raw URI in development (with password masked) for debugging
  if (process.env.NODE_ENV === 'development') {
    const rawMasked = rawUri.replace(/:([^:@]+)@/, ':****@');
    console.log('🔗 MongoDB URI (raw):', rawMasked);
  }
  
  const normalized = normalizeMongoURI(rawUri);
  
  // Log normalized URI in development (with password masked) for debugging
  if (process.env.NODE_ENV === 'development') {
    const maskedUri = normalized.replace(/:([^:@]+)@/, ':****@');
    console.log('🔗 MongoDB URI normalized:', maskedUri);
    
    // Check if database name is present
    const dbMatch = normalized.match(/@[^/]+\/([^?]+)/);
    if (!dbMatch) {
      console.warn('⚠️  Warning: Database name might be missing in connection string');
      console.warn('   Expected format: mongodb+srv://user:pass@host/database?options');
    }
  }
  
  return normalized;
})();

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
        
        // Provide helpful error messages for common issues
        if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
          console.error('💡 Authentication troubleshooting:');
          console.error('   1. Verify your username and password in MONGODB_URI');
          console.error('   2. If password contains special characters (@, :, /, #, %, etc.), they should be unencoded in .env');
          console.error('   3. Check that the database user exists in MongoDB Atlas');
          console.error('   4. Ensure your IP address is whitelisted in MongoDB Atlas');
          console.error('   5. Verify the connection string format: mongodb+srv://user:pass@host/database');
        }
        
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
