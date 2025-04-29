/**
 * Standard response format for successful operations
 * @param {Object} res - Express response object
 * @param {Number} statusCode - HTTP status code
 * @param {String} message - Response message
 * @param {Object|Array} data - Response data
 * @param {Object} meta - Additional metadata like pagination info
 */
exports.successResponse = (res, statusCode = 200, message = 'Success', data = null, meta = null) => {
    const response = {
      success: true,
      message
    };
  
    if (data !== null) {
      response.data = data;
    }
  
    if (meta !== null) {
      response.meta = meta;
    }
  
    return res.status(statusCode).json(response);
  };
  
  /**
   * Standard response format for error responses
   * @param {Object} res - Express response object
   * @param {Number} statusCode - HTTP status code
   * @param {String} message - Error message
   * @param {Object} errors - Detailed errors object (e.g., validation errors)
   */
  exports.errorResponse = (res, statusCode = 500, message = 'Error', errors = null) => {
    const response = {
      success: false,
      message
    };
  
    if (errors !== null) {
      response.errors = errors;
    }
  
    // Only include stack trace in development environment
    if (process.env.NODE_ENV === 'development' && errors && errors.stack) {
      response.stack = errors.stack;
    }
  
    return res.status(statusCode).json(response);
  };