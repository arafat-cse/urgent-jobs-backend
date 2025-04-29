const logger = require('../utils/logger');

// Custom error class for API errors
class ApiError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Central error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  
  // Log the error
  logger.error('Error:', {
    error: {
      message: error.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    }
  });

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ApiError(400, message);
  }

  // Duplicate key error
  if (err.code === '23505') { // PostgreSQL unique violation code
    error = new ApiError(400, 'Duplicate field value entered');
  }

  // Foreign key constraint error
  if (err.code === '23503') { // PostgreSQL foreign key violation code
    error = new ApiError(400, 'Related resource not found');
  }

  // JSON Web Token error
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Invalid token. Please log in again');
  }

  // JWT expired error
  if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Your token has expired. Please log in again');
  }

  // Default response
  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = {
  errorHandler,
  ApiError
};
