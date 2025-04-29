const { query } = require('../../db/connection');
const { ApiError } = require('../../middlewares/errorHandler');
const { successResponse } = require('../../utils/responseHandler');
const logger = require('../../utils/logger');

/**
 * Get dashboard statistics
 * @route GET /api/admin/dashboard
 * @access Private (Admin only)
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    // Get user counts by role
    const userCountsResult = await query(
      `SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'job_seeker' THEN 1 ELSE 0 END) as job_seekers,
        SUM(CASE WHEN role = 'employer' THEN 1 ELSE 0 END) as employers,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins
      FROM users`
    );
    
    // Get job counts by status
    const jobCountsResult = await query(
      `SELECT 
        COUNT(*) as total_jobs,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_jobs,
        SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled_jobs,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_jobs,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_jobs
      FROM jobs`
    );
    
    // Get application counts by status
    const applicationCountsResult = await query(
      `SELECT 
        COUNT(*) as total_applications,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_applications,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_applications,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_applications,
        SUM(CASE WHEN status = 'withdrawn' THEN 1 ELSE 0 END) as withdrawn_applications
      FROM job_applications`
    );
    
    // Get recent registrations (last 7 days)
    const recentRegistrationsResult = await query(
      `SELECT COUNT(*) as recent_registrations
       FROM users 
       WHERE created_at >= NOW() - INTERVAL '7 days'`
    );
    
    // Get recent jobs
    const recentJobsResult = await query(
      `SELECT j.id, j.title, j.status, j.created_at,
        ep.company_name,
        (SELECT COUNT(*) FROM job_applications WHERE job_id = j.id) as application_count
       FROM jobs j
       JOIN employer_profiles ep ON j.employer_id = ep.id
       ORDER BY j.created_at DESC
       LIMIT 5`
    );
    
    // Get recent applications
    const recentApplicationsResult = await query(
      `SELECT ja.id, ja.status, ja.created_at,
         j.title as job_title,
         u_seeker.first_name, u_seeker.last_name,
         ep.company_name
       FROM job_applications ja
       JOIN jobs j ON ja.job_id = j.id
       JOIN employer_profiles ep ON j.employer_id = ep.id
       JOIN job_seeker_profiles jsp ON ja.job_seeker_id = jsp.id
       JOIN users u_seeker ON jsp.user_id = u_seeker.id
       ORDER BY ja.created_at DESC
       LIMIT 5`
    );
    
    return successResponse(
      res, 
      200, 
      'Dashboard statistics retrieved successfully', 
      {
        users: userCountsResult.rows[0],
        jobs: jobCountsResult.rows[0],
        applications: applicationCountsResult.rows[0],
        recentRegistrations: recentRegistrationsResult.rows[0].recent_registrations,
        recentJobs: recentJobsResult.rows,
        recentApplications: recentApplicationsResult.rows
      }
    );
  } catch (error) {
    logger.error('Error getting admin dashboard stats', { error });
    return next(error);
  }
};