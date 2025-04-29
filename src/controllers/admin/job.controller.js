const { query } = require('../../db/connection');
const { ApiError } = require('../../middlewares/errorHandler');
const { successResponse } = require('../../utils/responseHandler');
const logger = require('../../utils/logger');

/**
 * Get all jobs with pagination and filtering
 * @route GET /api/admin/jobs
 * @access Private (Admin only)
 */
exports.getJobs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;
    
    let queryText = `
      SELECT j.*, 
      ep.company_name, ep.company_logo,
      u.first_name as employer_first_name, u.last_name as employer_last_name,
      u.email as employer_email,
      (SELECT COUNT(*) FROM job_applications WHERE job_id = j.id) as application_count
      FROM jobs j
      JOIN employer_profiles ep ON j.employer_id = ep.id
      JOIN users u ON ep.user_id = u.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCounter = 1;
    
    // Add status filter
    if (status) {
      queryText += ` AND j.status = $${paramCounter}`;
      queryParams.push(status);
      paramCounter++;
    }
    
    // Add search filter
    if (search) {
      queryText += ` AND (
        j.title ILIKE $${paramCounter} OR
        j.description ILIKE $${paramCounter} OR
        j.location_address ILIKE $${paramCounter} OR
        ep.company_name ILIKE $${paramCounter}
      )`;
      queryParams.push(`%${search}%`);
      paramCounter++;
    }
    
    // Add pagination
    queryText += ` ORDER BY j.created_at DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    queryParams.push(limit, offset);
    
    // Execute query
    const result = await query(queryText, queryParams);
    
    // Get total count
    let countQueryText = `
      SELECT COUNT(*) 
      FROM jobs j
      JOIN employer_profiles ep ON j.employer_id = ep.id
      WHERE 1=1
    `;
    
    const countParams = [];
    let countParamCounter = 1;
    
    if (status) {
      countQueryText += ` AND j.status = $${countParamCounter}`;
      countParams.push(status);
      countParamCounter++;
    }
    
    if (search) {
      countQueryText += ` AND (
        j.title ILIKE $${countParamCounter} OR
        j.description ILIKE $${countParamCounter} OR
        j.location_address ILIKE $${countParamCounter} OR
        ep.company_name ILIKE $${countParamCounter}
      )`;
      countParams.push(`%${search}%`);
    }
    
    const countResult = await query(countQueryText, countParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    return successResponse(
      res, 
      200, 
      'Jobs retrieved successfully', 
      result.rows,
      {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    );
  } catch (error) {
    logger.error('Error getting jobs', { error });
    return next(error);
  }
};

/**
 * Get job by ID
 * @route GET /api/admin/jobs/:id
 * @access Private (Admin only)
 */
exports.getJobById = async (req, res, next) => {
  try {
    const jobId = req.params.id;
    
    const result = await query(
      `SELECT j.*, 
      ep.company_name, ep.company_logo, ep.company_website,
      u.id as employer_id, u.first_name as employer_first_name, u.last_name as employer_last_name,
      u.email as employer_email,
      (SELECT COUNT(*) FROM job_applications WHERE job_id = j.id) as application_count
      FROM jobs j
      JOIN employer_profiles ep ON j.employer_id = ep.id
      JOIN users u ON ep.user_id = u.id
      WHERE j.id = $1`,
      [jobId]
    );
    
    if (result.rows.length === 0) {
      return next(new ApiError(404, 'Job not found'));
    }
    
    return successResponse(
      res, 
      200, 
      'Job retrieved successfully', 
      result.rows[0]
    );
  } catch (error) {
    logger.error('Error getting job details', { error, jobId: req.params.id });
    return next(error);
  }
};

/**
 * Update job status
 * @route PATCH /api/admin/jobs/:id/status
 * @access Private (Admin only)
 */
exports.updateJobStatus = async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['active', 'filled', 'expired', 'draft'];
    if (!validStatuses.includes(status)) {
      return next(new ApiError(400, `Status must be one of: ${validStatuses.join(', ')}`));
    }
    
    // Check if job exists
    const jobCheck = await query(
      'SELECT id FROM jobs WHERE id = $1',
      [jobId]
    );
    
    if (jobCheck.rows.length === 0) {
      return next(new ApiError(404, 'Job not found'));
    }
    
    // Update job status
    const result = await query(
      'UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, title, status',
      [status, jobId]
    );
    
    // If job is marked as filled or expired, also update any pending applications
    if (status === 'filled' || status === 'expired') {
      await query(
        `UPDATE job_applications 
        SET status = 'rejected', updated_at = NOW() 
        WHERE job_id = $1 AND status = 'pending'`,
        [jobId]
      );
    }
    
    return successResponse(
      res, 
      200, 
      `Job status updated to ${status} successfully`,
      result.rows[0]
    );
  } catch (error) {
    logger.error('Error updating job status', { error, jobId: req.params.id });
    return next(error);
  }
};

/**
 * Delete a job
 * @route DELETE /api/admin/jobs/:id
 * @access Private (Admin only)
 */
exports.deleteJob = async (req, res, next) => {
  try {
    const jobId = req.params.id;
    
    // Check if job exists
    const jobCheck = await query(
      'SELECT id FROM jobs WHERE id = $1',
      [jobId]
    );
    
    if (jobCheck.rows.length === 0) {
      return next(new ApiError(404, 'Job not found'));
    }
    
    // Delete job
    await query('DELETE FROM jobs WHERE id = $1', [jobId]);
    
    return successResponse(
      res, 
      200, 
      'Job deleted successfully'
    );
  } catch (error) {
    logger.error('Error deleting job', { error, jobId: req.params.id });
    return next(error);
  }
};