const JobApplication = require('../models/application.model');
const { query } = require('../db/connection');
const { ApiError } = require('../middlewares/errorHandler');
const { successResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const Notification = require('../models/notification.model');

/**
 * Apply for a job
 * @route POST /api/applications
 * @access Private (Job seekers only)
 */
exports.applyForJob = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { jobId, coverLetter } = req.body;
    
    // Get job seeker profile ID
    const jobSeekerResult = await query(
      'SELECT id FROM job_seeker_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (jobSeekerResult.rows.length === 0) {
      return next(new ApiError(404, 'Job seeker profile not found'));
    }
    
    const jobSeekerId = jobSeekerResult.rows[0].id;
    
    // Check if job exists
    const jobResult = await query(
      'SELECT * FROM jobs WHERE id = $1 AND status = $2',
      [jobId, 'active']
    );
    
    if (jobResult.rows.length === 0) {
      return next(new ApiError(404, 'Job not found or not active'));
    }
    
    // Check if already applied
    const hasApplied = await JobApplication.hasApplied(jobSeekerId, jobId);
    
    if (hasApplied) {
      return next(new ApiError(400, 'You have already applied for this job'));
    }
    
    // Create application
    const applicationData = { coverLetter };
    const application = await JobApplication.create(applicationData, jobSeekerId, jobId);
    
    // Get employer ID to send notification
    const employerResult = await query(
      `SELECT u.id, j.title
       FROM jobs j
       JOIN employer_profiles ep ON j.employer_id = ep.id
       JOIN users u ON ep.user_id = u.id
       WHERE j.id = $1`,
      [jobId]
    );
    
    // Get job seeker info for notification
    const jobSeekerInfoResult = await query(
      `SELECT u.first_name, u.last_name
       FROM users u
       JOIN job_seeker_profiles jsp ON u.id = jsp.user_id
       WHERE jsp.id = $1`,
      [jobSeekerId]
    );
    
    if (employerResult.rows.length > 0 && jobSeekerResult.rows.length > 0) {
      const employerId = employerResult.rows[0].id;
      const job = {
        title: employerResult.rows[0].title
      };
      const jobSeeker = jobSeekerResult.rows[0];
      
      // Create notification for employer
      await Notification.createNewApplicationNotification(
        application,
        job,
        jobSeeker,
        employerId
      );
    }
    
    // Add job info to response
    const job = jobResult.rows[0];
    const response = {
      ...application,
      job: {
        title: job.title,
        urgency: job.urgency,
        payAmount: job.pay_amount,
        payType: job.pay_type
      }
    };
    
    return successResponse(
      res, 
      201, 
      'Application submitted successfully', 
      response
    );
  } catch (error) {
    logger.error('Error applying for job', { error });
    return next(error);
  }
};

/**
 * Get job applications for a job
 * @route GET /api/applications/job/:jobId
 * @access Private (Employer who posted the job only)
 */
exports.getJobApplications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const jobId = req.params.jobId;
    
    // Check if job exists and belongs to the employer
    const jobCheck = await query(
      `SELECT j.* 
       FROM jobs j
       JOIN employer_profiles ep ON j.employer_id = ep.id
       WHERE j.id = $1 AND ep.user_id = $2`,
      [jobId, userId]
    );
    
    if (jobCheck.rows.length === 0) {
      return next(new ApiError(404, 'Job not found or you are not authorized to view its applications'));
    }
    
    // Get applications
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const filters = {
      status: req.query.status,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    
    const result = await JobApplication.findByJob(jobId, filters, page, limit);
    
    return successResponse(
      res, 
      200, 
      'Job applications retrieved successfully', 
      result.applications,
      result.pagination
    );
  } catch (error) {
    logger.error('Error getting job applications', { error, jobId: req.params.jobId });
    return next(error);
  }
};

/**
 * Get job seeker's applications
 * @route GET /api/applications/me
 * @access Private (Job seekers only)
 */
exports.getMyApplications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get job seeker profile ID
    const jobSeekerResult = await query(
      'SELECT id FROM job_seeker_profiles WHERE user_id = $1',
      [userId]
    );
    
    if (jobSeekerResult.rows.length === 0) {
      return next(new ApiError(404, 'Job seeker profile not found'));
    }
    
    const jobSeekerId = jobSeekerResult.rows[0].id;
    
    // Get applications
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const filters = {
      status: req.query.status,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    
    const result = await JobApplication.findByJobSeeker(jobSeekerId, filters, page, limit);
    
    return successResponse(
      res, 
      200, 
      'Your applications retrieved successfully', 
      result.applications,
      result.pagination
    );
  } catch (error) {
    logger.error('Error getting job seeker applications', { error });
    return next(error);
  }
};

/**
 * Get application by ID
 * @route GET /api/applications/:id
 * @access Private (Job seeker who applied or employer who posted the job)
 */
exports.getApplicationById = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const userId = req.user.id;
    
    // Get application with details
    const application = await JobApplication.findById(applicationId, true);
    
    if (!application) {
      return next(new ApiError(404, 'Application not found'));
    }
    
    // Check authorization
    let authorized = false;
    
    if (req.user.role === 'job_seeker') {
      // Check if this job seeker is the applicant
      const jobSeekerResult = await query(
        `SELECT jsp.id 
         FROM job_seeker_profiles jsp
         WHERE jsp.user_id = $1 AND jsp.id = $2`,
        [userId, application.job_seeker_id]
      );
      
      authorized = jobSeekerResult.rows.length > 0;
    } else if (req.user.role === 'employer') {
      // Check if this employer posted the job
      const employerResult = await query(
        `SELECT j.id 
         FROM jobs j
         JOIN employer_profiles ep ON j.employer_id = ep.id
         WHERE ep.user_id = $1 AND j.id = $2`,
        [userId, application.job_id]
      );
      
      authorized = employerResult.rows.length > 0;
    }
    
    if (!authorized && req.user.role !== 'admin') {
      return next(new ApiError(403, 'You are not authorized to view this application'));
    }
    
    return successResponse(
      res, 
      200, 
      'Application retrieved successfully', 
      application
    );
  } catch (error) {
    logger.error('Error getting application by ID', { error, applicationId: req.params.id });
    return next(error);
  }
};

/**
 * Update application status
 * @route PATCH /api/applications/:id/status
 * @access Private (Employer who posted the job or job seeker who applied)
 */
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const { status } = req.body;
    const userId = req.user.id;
    
    // Validate status values
    const validStatusValues = ['pending', 'accepted', 'rejected', 'withdrawn'];
    if (!validStatusValues.includes(status)) {
      return next(new ApiError(400, `Status must be one of: ${validStatusValues.join(', ')}`));
    }
    
    // Get application
    const application = await JobApplication.findById(applicationId);
    
    if (!application) {
      return next(new ApiError(404, 'Application not found'));
    }
    
    // Check authorization
    let authorized = false;
    
    if (req.user.role === 'employer') {
      // Employers can only change status to accepted or rejected
      if (!['accepted', 'rejected'].includes(status)) {
        return next(new ApiError(400, 'Employers can only accept or reject applications'));
      }
      
      // Check if this employer posted the job
      const employerResult = await query(
        `SELECT j.id 
         FROM jobs j
         JOIN employer_profiles ep ON j.employer_id = ep.id
         WHERE ep.user_id = $1 AND j.id = $2`,
        [userId, application.job_id]
      );
      
      authorized = employerResult.rows.length > 0;
    } else if (req.user.role === 'job_seeker') {
      // Job seekers can only withdraw their applications
      if (status !== 'withdrawn') {
        return next(new ApiError(400, 'Job seekers can only withdraw their applications'));
      }
      
      // Check if this job seeker is the applicant
      const jobSeekerResult = await query(
        `SELECT jsp.id 
         FROM job_seeker_profiles jsp
         WHERE jsp.user_id = $1 AND jsp.id = $2`,
        [userId, application.job_seeker_id]
      );
      
      authorized = jobSeekerResult.rows.length > 0;
    }
    
    if (!authorized && req.user.role !== 'admin') {
      return next(new ApiError(403, 'You are not authorized to update this application'));
    }
    
    // Update application status
    const updatedApplication = await JobApplication.updateStatus(applicationId, status);
    
    // Send notification to the appropriate user
    try {
      // Get notification details
      const applicationDetailsResult = await query(
        `SELECT ja.*, j.title as job_title,
         jsp.user_id as job_seeker_user_id,
         ep.user_id as employer_user_id
         FROM job_applications ja
         JOIN jobs j ON ja.job_id = j.id
         JOIN job_seeker_profiles jsp ON ja.job_seeker_id = jsp.id
         JOIN employer_profiles ep ON j.employer_id = ep.id
         WHERE ja.id = $1`,
        [applicationId]
      );
      
      if (applicationDetailsResult.rows.length > 0) {
        const applicationDetails = applicationDetailsResult.rows[0];
        let targetUserId;
        
        // Determine which user to notify
        if (req.user.role === 'employer' && ['accepted', 'rejected'].includes(status)) {
          // Employer updated status, notify job seeker
          targetUserId = applicationDetails.job_seeker_user_id;
        } else if (req.user.role === 'job_seeker' && status === 'withdrawn') {
          // Job seeker withdrew application, notify employer
          targetUserId = applicationDetails.employer_user_id;
        }
        
        if (targetUserId) {
          await Notification.createApplicationStatusNotification(
            applicationDetails,
            status,
            targetUserId
          );
        }
      }
    } catch (notificationError) {
      // Log but don't fail the request if notification creation fails
      logger.error('Error creating status change notification', { 
        error: notificationError,
        applicationId,
        status
      });
    }
    
    return successResponse(
      res, 
      200, 
      'Application status updated successfully', 
      updatedApplication
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