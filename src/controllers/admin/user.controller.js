const { query } = require('../../db/connection');
const { ApiError } = require('../../middlewares/errorHandler');
const { successResponse } = require('../../utils/responseHandler');
const logger = require('../../utils/logger');

/**
 * Get all users with pagination and filtering
 * @route GET /api/admin/users
 * @access Private (Admin only)
 */
exports.getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const role = req.query.role;
    const search = req.query.search;
    
    // First check if the active column exists
    let activeColumnExists = false;
    try {
      await query('SELECT active FROM users LIMIT 1');
      activeColumnExists = true;
    } catch (err) {
      // Column doesn't exist, that's okay
      activeColumnExists = false;
      logger.info('Active column does not exist in users table');
    }
    
    // Build the query based on whether the active column exists
    let queryText = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, 
        u.role, u.profile_picture, u.created_at,
        CASE 
          WHEN u.role = 'employer' THEN ep.company_name 
          ELSE NULL 
        END as company_name
    `;
    
    // Only add the active column if it exists
    if (activeColumnExists) {
      queryText += `, u.active`;
    } else {
      queryText += `, true as active`; // Default all users to active if column doesn't exist
    }
    
    queryText += `
      FROM users u
      LEFT JOIN employer_profiles ep ON u.id = ep.user_id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCounter = 1;
    
    // Add role filter if provided
    if (role) {
      queryText += ` AND u.role = $${paramCounter}`;
      queryParams.push(role);
      paramCounter++;
    }
    
    // Add search filter if provided
    if (search) {
      queryText += ` AND (
        u.email ILIKE $${paramCounter} OR
        u.first_name ILIKE $${paramCounter} OR
        u.last_name ILIKE $${paramCounter} OR
        CASE WHEN u.role = 'employer' THEN ep.company_name ILIKE $${paramCounter} ELSE false END
      )`;
      queryParams.push(`%${search}%`);
      paramCounter++;
    }
    
    // Add pagination
    queryText += ` ORDER BY u.created_at DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    queryParams.push(limit, offset);
    
    // Execute query
    const result = await query(queryText, queryParams);
    
    // Get total count for pagination
    let countQueryText = `
      SELECT COUNT(*) 
      FROM users u
      LEFT JOIN employer_profiles ep ON u.id = ep.user_id
      WHERE 1=1
    `;
    
    if (role) {
      countQueryText += ` AND u.role = $1`;
    }
    
    if (search) {
      countQueryText += ` AND (
        u.email ILIKE $${role ? 2 : 1} OR
        u.first_name ILIKE $${role ? 2 : 1} OR
        u.last_name ILIKE $${role ? 2 : 1} OR
        CASE WHEN u.role = 'employer' THEN ep.company_name ILIKE $${role ? 2 : 1} ELSE false END
      )`;
    }
    
    const countParams = [];
    if (role) countParams.push(role);
    if (search) countParams.push(`%${search}%`);
    
    const countResult = await query(countQueryText, countParams);
    const totalCount = parseInt(countResult.rows[0].count);


    const formattedRows = result.rows.map(user => ({
        id: user.id,
        email: user.email || '',
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone: user.phone || '',
        role: user.role || '',
        profile_picture: user.profile_picture || null,
        created_at: user.created_at || new Date().toISOString(),
        company_name: user.company_name || null,
        active: typeof user.active === 'boolean' ? user.active : true,
      }));

      return successResponse(
        res, 
        200, 
        'Users retrieved successfully', 
        formattedRows,  // Use formatted rows
        {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      );
    } catch (error) {
      logger.error('Error getting users', { error });
      return next(error);
    }
  };
/**
 * Get user details by ID
 * @route GET /api/admin/users/:id
 * @access Private (Admin only)
 */
exports.getUserById = async (req, res, next) => {
  try {
    const userId = req.params.id;
    
    // First check if the active column exists
    let activeColumnExists = false;
    try {
      await query('SELECT active FROM users LIMIT 1');
      activeColumnExists = true;
    } catch (err) {
      // Column doesn't exist, that's okay
      activeColumnExists = false;
      logger.info('Active column does not exist in users table');
    }
    
    // Get user role first
    const userRoleResult = await query(
      'SELECT role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userRoleResult.rows.length === 0) {
      return next(new ApiError(404, 'User not found'));
    }
    
    const role = userRoleResult.rows[0].role;
    let userData;
    
    if (role === 'job_seeker') {
      let queryText = `
        SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.profile_picture,
        u.created_at, u.updated_at,
      `;
      
      // Add active column if it exists
      if (activeColumnExists) {
        queryText += ` u.active,`;
      } else {
        queryText += ` true as active,`;
      }
      
      queryText += `
        jsp.id as profile_id, jsp.bio, jsp.skills, jsp.experience_years, jsp.education, 
        jsp.availability, jsp.location_latitude, jsp.location_longitude, jsp.location_address
        FROM users u
        LEFT JOIN job_seeker_profiles jsp ON u.id = jsp.user_id
        WHERE u.id = $1
      `;
      
      const result = await query(queryText, [userId]);
      userData = result.rows[0];
    } else if (role === 'employer') {
      let queryText = `
        SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.profile_picture,
        u.created_at, u.updated_at,
      `;
      
      // Add active column if it exists
      if (activeColumnExists) {
        queryText += ` u.active,`;
      } else {
        queryText += ` true as active,`;
      }
      
      queryText += `
        ep.id as profile_id, ep.company_name, ep.company_description, ep.company_website, 
        ep.company_logo, ep.industry, ep.location_latitude, ep.location_longitude, ep.location_address
        FROM users u
        LEFT JOIN employer_profiles ep ON u.id = ep.user_id
        WHERE u.id = $1
      `;
      
      const result = await query(queryText, [userId]);
      userData = result.rows[0];
    } else {
      let queryText = `
        SELECT id, email, first_name, last_name, phone, role, profile_picture, 
        created_at, updated_at
      `;
      
      // Add active column if it exists
      if (activeColumnExists) {
        queryText += `, active`;
      } else {
        queryText += `, true as active`;
      }
      
      queryText += `
        FROM users 
        WHERE id = $1
      `;
      
      const result = await query(queryText, [userId]);
      userData = result.rows[0];
    }
    
    if (!userData) {
      return next(new ApiError(404, 'User not found'));
    }
    
    return successResponse(
      res, 
      200, 
      'User details retrieved successfully', 
      userData
    );
  } catch (error) {
    logger.error('Error getting user details', { error });
    return next(error);
  }
};

/**
 * Update user status (active/inactive)
 * @route PATCH /api/admin/users/:id/status
 * @access Private (Admin only)
 */
exports.updateUserStatus = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { active } = req.body;
    
    if (typeof active !== 'boolean') {
      return next(new ApiError(400, 'Active status must be a boolean'));
    }
    
    // Check if user exists
    const userCheck = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );
    
    if (userCheck.rows.length === 0) {
      return next(new ApiError(404, 'User not found'));
    }
    
    // Prevent deactivating yourself
    if (userCheck.rows[0].id === req.user.id && !active) {
      return next(new ApiError(400, 'You cannot deactivate your own account'));
    }
    
    // Check if active column exists
    let activeColumnExists = false;
    try {
      await query('SELECT active FROM users LIMIT 1');
      activeColumnExists = true;
    } catch (err) {
      // Column doesn't exist
      activeColumnExists = false;
    }
    
    if (!activeColumnExists) {
      // Add active column
      try {
        await query('ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT true');
        logger.info('Added active column to users table');
        activeColumnExists = true;
      } catch (err) {
        logger.error('Error adding active column to users table', { error: err });
        return next(new ApiError(500, 'Failed to update user status structure'));
      }
    }
    
    // Update user status
    const result = await query(
      'UPDATE users SET active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, role, active',
      [active, userId]
    );
    
    return successResponse(
      res, 
      200, 
      `User ${active ? 'activated' : 'deactivated'} successfully`,
      result.rows[0]
    );
  } catch (error) {
    logger.error('Error updating user status', { error });
    return next(error);
  }
};