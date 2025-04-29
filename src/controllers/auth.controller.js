const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');
const { ApiError } = require('../middlewares/errorHandler');
const { successResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

/**
 * Generate JWT token
 * @param {Number} id - User ID
 * @param {String} role - User role
 * @returns {String} JWT token
 */
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone, role } = req.body;

    // Check if valid role
    if (!['job_seeker', 'employer'].includes(role)) {
      return next(new ApiError(400, 'Invalid role. Must be job_seeker or employer'));
    }

    // Check if user already exists
    const userExists = await query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userExists.rows.length > 0) {
      return next(new ApiError(400, 'User with this email already exists'));
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Begin transaction
    const client = await query.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create user
      const userResult = await client.query(
        `INSERT INTO users 
        (email, password, first_name, last_name, phone, role) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING id, email, first_name, last_name, role`,
        [email, hashedPassword, firstName, lastName, phone, role]
      );
      
      const user = userResult.rows[0];
      
      // Create profile based on role
      if (role === 'job_seeker') {
        await client.query(
          'INSERT INTO job_seeker_profiles (user_id) VALUES ($1)',
          [user.id]
        );
      } else if (role === 'employer') {
        const { companyName = '' } = req.body;
        await client.query(
          'INSERT INTO employer_profiles (user_id, company_name) VALUES ($1, $2)',
          [user.id, companyName]
        );
      }
      
      await client.query('COMMIT');
      
      // Generate token
      const token = generateToken(user.id, user.role);
      
      return successResponse(
        res, 
        201, 
        'User registered successfully', 
        { user, token }
      );
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction error during registration', { error });
      return next(error);
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Registration error', { error });
    return next(error);
  }
};

/**
 * Login a user
 * @route POST /api/auth/login
 * @access Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const result = await query(
      `SELECT u.id, u.email, u.password, u.first_name, u.last_name, u.role,
      CASE 
        WHEN u.role = 'employer' THEN ep.company_name
        ELSE NULL
      END AS company_name
      FROM users u
      LEFT JOIN employer_profiles ep ON u.id = ep.user_id
      WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return next(new ApiError(401, 'Invalid credentials'));
    }

    const user = result.rows[0];

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return next(new ApiError(401, 'Invalid credentials'));
    }

    // Remove password from response
    delete user.password;

    // Generate token
    const token = generateToken(user.id, user.role);

    return successResponse(
      res, 
      200, 
      'Login successful', 
      { user, token }
    );
  } catch (error) {
    logger.error('Login error', { error });
    return next(error);
  }
};

/**
 * Get current user profile
 * @route GET /api/auth/me
 * @access Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    let userData;
    
    if (userRole === 'job_seeker') {
      const result = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.profile_picture,
        jsp.bio, jsp.skills, jsp.experience_years, jsp.education, jsp.availability,
        jsp.location_latitude, jsp.location_longitude, jsp.location_address
        FROM users u
        JOIN job_seeker_profiles jsp ON u.id = jsp.user_id
        WHERE u.id = $1`,
        [userId]
      );
      
      userData = result.rows[0];
    } else if (userRole === 'employer') {
      const result = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.profile_picture,
        ep.company_name, ep.company_description, ep.company_website, ep.company_logo, ep.industry,
        ep.location_latitude, ep.location_longitude, ep.location_address
        FROM users u
        JOIN employer_profiles ep ON u.id = ep.user_id
        WHERE u.id = $1`,
        [userId]
      );
      
      userData = result.rows[0];
    } else {
      const result = await query(
        `SELECT id, email, first_name, last_name, phone, role, profile_picture
        FROM users 
        WHERE id = $1`,
        [userId]
      );
      
      userData = result.rows[0];
    }
    
    if (!userData) {
      return next(new ApiError(404, 'User not found'));
    }
    
    return successResponse(
      res, 
      200, 
      'User profile retrieved successfully', 
      userData
    );
  } catch (error) {
    logger.error('Get user profile error', { error });
    return next(error);
  }
};

/**
 * Update password
 * @route PUT /api/auth/password
 * @access Private
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    // Get user with password
    const result = await query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      return next(new ApiError(404, 'User not found'));
    }
    
    const user = result.rows[0];
    
    // Check if current password matches
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return next(new ApiError(401, 'Current password is incorrect'));
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update password
    await query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedPassword, userId]
    );
    
    return successResponse(
      res, 
      200, 
      'Password updated successfully'
    );
  } catch (error) {
    logger.error('Update password error', { error });
    return next(error);
  }
};