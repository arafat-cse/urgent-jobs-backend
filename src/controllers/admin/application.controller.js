const { query } = require('../../db/connection');
const { ApiError } = require('../../middlewares/errorHandler');
const { successResponse } = require('../../utils/responseHandler');
const logger = require('../../utils/logger');

/**
 * Get all applications with pagination and filtering
 * @route GET /api/admin/applications
 * @access Private (Admin only)
 */
exports.getApplications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const jobId = req.query.jobId ? parseInt(req.query.jobId) : null;
    
    let queryText = `
      SELECT ja.*,
      j.title as job_title, j.description, j.pay_amount, j.pay_type,
      j.location_address as job_location, j.urgency,
      ep.company_name, ep.company_logo,
      seeker.id as seeker_user_id, seeker.first_name as seeker_first_name, 
      seeker.last_name as seeker_last_name, seeker.email as seeker_email, 
      seeker.profile_picture as seeker_profile_picture,
      employer.id as employer_user_id, employer.first_name as employer_first_name, 
      employer.last_name as employer_last_name, employer.email as employer_email
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      JOIN employer_profiles ep ON j.employer_id = ep.id
      JOIN users employer ON ep.user_id = employer.id
      JOIN job_seeker_profiles jsp ON ja.job_seeker_id = jsp.id
      JOIN users seeker ON jsp.user_id = seeker.id
      WHERE 1=1
    `;
    
    const queryParams = [];
    let paramCounter = 1;
    
    if (status) {
      queryText += ` AND ja.status = $${paramCounter}`;
      queryParams.push(status);
      paramCounter++;
    }
    
    if (jobId) {
      queryText += ` AND ja.job_id = $${paramCounter}`;
      queryParams.push(jobId);
      paramCounter++;
    }
    
    queryText += ` ORDER BY ja.created_at DESC LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
    queryParams.push(limit, offset);
    
    const result = await query(queryText, queryParams);
    
    // Get total count
    let countQueryText = `
      SELECT COUNT(*) 
      FROM job_applications ja
      WHERE 1=1
    `;
    
    const countParams = [];
    let countParamCounter = 1;
    
    if (status) {
      countQueryText += ` AND ja.status = $${countParamCounter}`;
      countParams.push(status);
      countParamCounter++;
    }
    
    if (jobId) {
      countQueryText += ` AND ja.job_id = $${countParamCounter}`;
      countParams.push(jobId);
    }
    
    const countResult = await query(countQueryText, countParams);
    const totalCount = parseInt(countResult.rows[0].count);
    
    return successResponse(
      res, 
      200, 
      'Applications retrieved successfully', 
      result.rows,
      {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    );
  } catch (error) {
    logger.error('Error getting applications', { error });
    return next(error);
  }
};

/**
 * Get application by ID
 * @route GET /api/admin/applications/:id
 * @access Private (Admin only)
 */
exports.getApplicationById = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    
    const result = await query(
      `SELECT ja.*,
      j.title as job_title, j.description, j.pay_amount, j.pay_type,
      j.location_address as job_location, j.urgency,
      ep.company_name, ep.company_logo,
      seeker.id as seeker_user_id, seeker.first_name as seeker_first_name, 
      seeker.last_name as seeker_last_name, seeker.email as seeker_email, 
      seeker.profile_picture as seeker_profile_picture,
      employer.id as employer_user_id, employer.first_name as employer_first_name, 
      employer.last_name as employer_last_name, employer.email as employer_email
      FROM job_applications ja
      JOIN jobs j ON ja.job_id = j.id
      JOIN employer_profiles ep ON j.employer_id = ep.id
      JOIN users employer ON ep.user_id = employer.id
      JOIN job_seeker_profiles jsp ON ja.job_seeker_id = jsp.id
      JOIN users seeker ON jsp.user_id = seeker.id
      WHERE ja.id = $1`,
      [applicationId]
    );
    
    if (result.rows.length === 0) {
      return next(new ApiError(404, 'Application not found'));
    }
    
    return successResponse(
      res, 
      200, 
      'Application retrieved successfully', 
      result.rows[0]
    );
  } catch (error) {
    logger.error('Error getting application details', { error, applicationId: req.params.id });
    return next(error);
  }
};

/**
 * Update application status
 * @route PATCH /api/admin/applications/:id/status
 * @access Private (Admin only)
 */
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['pending', 'accepted', 'rejected', 'withdrawn'];
    if (!validStatuses.includes(status)) {
      return next(new ApiError(400, `Status must be one of: ${validStatuses.join(', ')}`));
    }
    
    // Check if application exists
    const applicationCheck = await query(
      'SELECT id, job_id FROM job_applications WHERE id = $1',
      [applicationId]
    );
    
    if (applicationCheck.rows.length === 0) {
      return next(new ApiError(404, 'Application not found'));
    }
    
    // Update application status
    const result = await query(
      'UPDATE job_applications SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, job_id, status',
      [status, applicationId]
    );
    
    // If application is accepted, mark all other applications for this job as rejected
    if (status === 'accepted') {
      const jobId = applicationCheck.rows[0].job_id;
      
      // Update other pending applications to rejected
      await query(
        `UPDATE job_applications 
        SET status = 'rejected', updated_at = NOW() 
        WHERE job_id = $1 AND id != $2 AND status = 'pending'`,
        [jobId, applicationId]
      );
      
      // Update job status to filled
      await query(
        'UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2',
        ['filled', jobId]
      );
    }
    
    return successResponse(
      res, 
      200, 
      `Application status updated to ${status} successfully`,
      result.rows[0]
    );
  } catch (error) {
    logger.error('Error updating application status', { 
      error, 
      applicationId: req.params.id,
      status: req.body.status 
    });
    return next(error);
  }
};