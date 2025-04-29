const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');
const { ApiError } = require('./errorHandler');

/**
 * Middleware to protect routes by verifying JWT token
 */
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Check if token exists in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check if token exists
    if (!token) {
      return next(new ApiError(401, 'Not authorized to access this route'));
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists
    const result = await query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [decoded.id]
    );
    
    if (result.rows.length === 0) {
      return next(new ApiError(401, 'User no longer exists'));
    }
    
    // Add user to request object
    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new ApiError(401, 'Invalid token'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Token expired'));
    }
    next(error);
  }
};

/**
 * Middleware to authorize specific roles
 * @param {...String} roles - Roles to authorize
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Not authorized to access this route'));
    }
    next();
  };
};