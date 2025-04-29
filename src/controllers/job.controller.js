const Job = require('../models/job.model');
const { query } = require('../db/connection');
const { ApiError } = require('../middlewares/errorHandler');
const { successResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

/**
 * Create a new job
 * @route POST /api/jobs
 * @access Private (Employers only)
 */
exports.createJob = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get employer profile ID
    const employerResult = await query(
      'SELECT id FROM employer_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (employerResult.rows.length === 0) {
      return next(new ApiError(404, 'Employer profile not found'));
    }
    
    const employerId = employerResult.rows[0].id;
    
    // Create job
    const jobData = {
      title: req.body.title,
      description: req.body.description,
      requirements: req.body.requirements,
      payAmount: req.body.payAmount,
      payType: req.body.payType,
      locationLatitude: req.body.locationLatitude,
      locationLongitude: req.body.locationLongitude,
      locationAddress: req.body.locationAddress,
      urgency: req.body.urgency,
      category: req.body.category,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      estimatedHours: req.body.estimatedHours,
      status: req.body.status || 'active'
    };
    
    const job = await Job.create(jobData, employerId);
    
    return successResponse(
      res, 
      201, 
      'Job created successfully', 
      job
    );
  } catch (error) {
    logger.error('Error creating job', { error });
    return next(error);
  }
};

/**
 * Get all jobs with filtering
 * @route GET /api/jobs
 * @access Public
 */
exports.getJobs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Extract filter parameters
    const filters = {
      status: req.query.status || 'active',
      category: req.query.category,
      urgency: req.query.urgency,
      minPay: req.query.minPay ? parseFloat(req.query.minPay) : null,
      maxPay: req.query.maxPay ? parseFloat(req.query.maxPay) : null,
      payType: req.query.payType,
      keyword: req.query.keyword,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    
    // Location-based search
    if (req.query.latitude && req.query.longitude && req.query.radius) {
      filters.latitude = parseFloat(req.query.latitude);
      filters.longitude = parseFloat(req.query.longitude);
      filters.radius = parseFloat(req.query.radius);
    }
    
    const result = await Job.findAll(filters, page, limit);
    
    return successResponse(
      res, 
      200, 
      'Jobs retrieved successfully', 
      result.jobs,
      result.pagination
    );
  } catch (error) {
    logger.error('Error getting jobs', { error });
    return next(error);
  }
};

/**
 * Get job by ID
 * @route GET /api/jobs/:id
 * @access Public
 */
exports.getJobById = async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findById(jobId, true);
    
    if (!job) {
      return next(new ApiError(404, 'Job not found'));
    }
    
    return successResponse(
      res, 
      200, 
      'Job retrieved successfully', 
      job
    );
  } catch (error) {
    logger.error('Error getting job by ID', { error, jobId: req.params.id });
    return next(error);
  }
};

/**
 * Update job
 * @route PUT /api/jobs/:id
 * @access Private (Job owner only)
 */
exports.updateJob = async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.id;
    
    // Check if job exists and belongs to the employer
    const jobCheck = await query(
      `SELECT j.* 
       FROM jobs j
       JOIN employer_profiles ep ON j.employer_id = ep.id
       WHERE j.id = $1 AND ep.user_id = $2`,
      [jobId, userId]
    );
    
    if (jobCheck.rows.length === 0) {
      return next(new ApiError(404, 'Job not found or you are not authorized to update it'));
    }
    
    // Update fields that are provided
    const updateData = {};
    const allowedFields = [
      'title', 'description', 'requirements', 'payAmount', 'payType',
      'locationLatitude', 'locationLongitude', 'locationAddress',
      'urgency', 'category', 'startDate', 'endDate', 'estimatedHours', 'status'
    ];
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    
    // Update job
    const updatedJob = await Job.update(jobId, updateData);
    
    return successResponse(
      res, 
      200, 
      'Job updated successfully', 
      updatedJob
    );
  } catch (error) {
    logger.error('Error updating job', { error, jobId: req.params.id });
    return next(error);
  }
};

/**
 * Delete job
 * @route DELETE /api/jobs/:id
 * @access Private (Job owner only)
 */
exports.deleteJob = async (req, res, next) => {
  try {
    const jobId = req.params.id;
    const userId = req.user.id;
    
    // Check if job exists and belongs to the employer
    const jobCheck = await query(
      `SELECT j.* 
       FROM jobs j
       JOIN employer_profiles ep ON j.employer_id = ep.id
       WHERE j.id = $1 AND ep.user_id = $2`,
      [jobId, userId]
    );
    
    if (jobCheck.rows.length === 0) {
      return next(new ApiError(404, 'Job not found or you are not authorized to delete it'));
    }
    
    // Delete job
    await Job.delete(jobId);
    
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

/**
 * Get jobs by employer
 * @route GET /api/jobs/employer
 * @access Private (Employers only)
 */
exports.getEmployerJobs = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get employer profile ID
    const employerResult = await query(
      'SELECT id FROM employer_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (employerResult.rows.length === 0) {
      return next(new ApiError(404, 'Employer profile not found'));
    }
    
    const employerId = employerResult.rows[0].id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // Extract filter parameters
    const filters = {
      status: req.query.status,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    
    const result = await Job.findByEmployer(employerId, filters, page, limit);
    
    return successResponse(
      res, 
      200, 
      'Employer jobs retrieved successfully', 
      result.jobs,
      result.pagination
    );
  } catch (error) {
    logger.error('Error getting employer jobs', { error });
    return next(error);
  }
};