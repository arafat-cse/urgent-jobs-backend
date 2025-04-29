const { validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors
 */
const validationMiddleware = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Format errors for a cleaner response
    const formattedErrors = {};
    
    errors.array().forEach(error => {
      formattedErrors[error.path] = error.msg;
    });
    
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: formattedErrors
    });
  }
  
  next();
};

module.exports = validationMiddleware;