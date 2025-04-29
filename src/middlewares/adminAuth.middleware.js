const { ApiError } = require('./errorHandler');

/**
 * Middleware to ensure the user is an admin
 * Uses the existing auth middleware for authentication
 * Must be used after the protect middleware
 */
exports.ensureAdmin = (req, res, next) => {
  // Check if user exists and is admin
  if (!req.user || req.user.role !== 'admin') {
    return next(new ApiError(403, 'Access denied. Admin privileges required.'));
  }
  
  next();
};