const { query } = require('../db/connection');
const logger = require('../utils/logger');

/**
 * Job Application model encapsulating database operations for job applications
 */
module.exports = class JobApplication {
  /**
   * Create a new job application
   * @param {Object} applicationData - Application data
   * @param {Number} jobSeekerId - Job seeker profile ID
   * @param {Number} jobId - Job ID
   */
  static async create(applicationData, jobSeekerId, jobId) {
    try {
      const { coverLetter } = applicationData;

      const result = await query(
        `INSERT INTO job_applications (
          job_id, job_seeker_id, cover_letter, status
        ) VALUES ($1, $2, $3, 'pending')
        RETURNING *`,
        [jobId, jobSeekerId, coverLetter]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating job application', { error });
      throw error;
    }
  }

  /**
   * Find application by ID
   * @param {Number} id - Application ID
   * @param {Boolean} includeDetails - Whether to include job and job seeker details
   */
  static async findById(id, includeDetails = false) {
    try {
      let queryText;
      
      if (includeDetails) {
        queryText = `
          SELECT ja.*, 
          j.title as job_title, j.pay_amount, j.pay_type, j.urgency,
          j.location_address as job_location,
          ep.company_name,
          u_employer.first_name as employer_first_name, 
          u_employer.last_name as employer_last_name,
          u_seeker.first_name as seeker_first_name, 
          u_seeker.last_name as seeker_last_name,
          u_seeker.profile_picture as seeker_profile_picture
          FROM job_applications ja
          JOIN jobs j ON ja.job_id = j.id
          JOIN employer_profiles ep ON j.employer_id = ep.id
          JOIN users u_employer ON ep.user_id = u_employer.id
          JOIN job_seeker_profiles jsp ON ja.job_seeker_id = jsp.id
          JOIN users u_seeker ON jsp.user_id = u_seeker.id
          WHERE ja.id = $1
        `;
      } else {
        queryText = 'SELECT * FROM job_applications WHERE id = $1';
      }

      const result = await query(queryText, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding application by ID', { error, id });
      throw error;
    }
  }

  /**
   * Update application status
   * @param {Number} id - Application ID
   * @param {String} status - New status
   */
  static async updateStatus(id, status) {
    try {
      const result = await query(
        `UPDATE job_applications
         SET status = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, id]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating application status', { error, id, status });
      throw error;
    }
  }

  /**
   * Check if a job seeker has already applied to a job
   * @param {Number} jobSeekerId - Job seeker profile ID
   * @param {Number} jobId - Job ID
   */
  static async hasApplied(jobSeekerId, jobId) {
    try {
      const result = await query(
        'SELECT * FROM job_applications WHERE job_seeker_id = $1 AND job_id = $2',
        [jobSeekerId, jobId]
      );
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking if job seeker has applied', { error, jobSeekerId, jobId });
      throw error;
    }
  }

  /**
   * Get applications for a specific job
   * @param {Number} jobId - Job ID
   * @param {Object} filters - Filter criteria
   * @param {Number} page - Page number
   * @param {Number} limit - Items per page
   */
  static async findByJob(jobId, filters = {}, page = 1, limit = 10) {
    try {
      // Calculate offset for pagination
      const offset = (page - 1) * limit;
      
      // Build query
      let queryText = `
        SELECT ja.*,
        u.first_name, u.last_name, u.profile_picture,
        jsp.skills, jsp.experience_years, jsp.education
        FROM job_applications ja
        JOIN job_seeker_profiles jsp ON ja.job_seeker_id = jsp.id
        JOIN users u ON jsp.user_id = u.id
        WHERE ja.job_id = $1
      `;
      
      const queryParams = [jobId];
      let paramCounter = 2;
      
      // Add status filter if provided
      if (filters.status) {
        queryText += ` AND ja.status = ${paramCounter}`;
        queryParams.push(filters.status);
        paramCounter++;
      }
      
      // Add sorting
      const sortField = filters.sortBy || 'created_at';
      const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
      
      queryText += ` ORDER BY ja.${sortField} ${sortOrder}`;
      
      // Add pagination
      queryText += ` LIMIT ${paramCounter} OFFSET ${paramCounter + 1}`;
      queryParams.push(limit, offset);
      
      // Execute query
      const result = await query(queryText, queryParams);
      
      // Get total count for pagination
      let countQueryText = `
        SELECT COUNT(*) 
        FROM job_applications
        WHERE job_id = $1
      `;
      
      // Add status filter to count query if provided
      if (filters.status) {
        countQueryText += ` AND status = $2`;
      }
      
      const countParams = filters.status ? [jobId, filters.status] : [jobId];
      const countResult = await query(countQueryText, countParams);
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        applications: result.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding applications by job', { error, jobId });
      throw error;
    }
  }

  /**
   * Get applications for a specific job seeker
   * @param {Number} jobSeekerId - Job seeker profile ID
   * @param {Object} filters - Filter criteria
   * @param {Number} page - Page number
   * @param {Number} limit - Items per page
   */
  static async findByJobSeeker(jobSeekerId, filters = {}, page = 1, limit = 10) {
    try {
      // Calculate offset for pagination
      const offset = (page - 1) * limit;
      
      // Build query
      let queryText = `
        SELECT ja.*,
        j.title as job_title, j.description, j.pay_amount, j.pay_type,
        j.location_address as job_location, j.urgency,
        ep.company_name, ep.company_logo
        FROM job_applications ja
        JOIN jobs j ON ja.job_id = j.id
        JOIN employer_profiles ep ON j.employer_id = ep.id
        WHERE ja.job_seeker_id = $1
      `;
      
      const queryParams = [jobSeekerId];
      let paramCounter = 2;
      
      // Add status filter if provided
      if (filters.status) {
        queryText += ` AND ja.status = ${paramCounter}`;
        queryParams.push(filters.status);
        paramCounter++;
      }
      
      // Add sorting
      const sortField = filters.sortBy || 'ja.created_at';
      const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
      
      queryText += ` ORDER BY ${sortField} ${sortOrder}`;
      
      // Add pagination
      queryText += ` LIMIT ${paramCounter} OFFSET ${paramCounter + 1}`;
      queryParams.push(limit, offset);
      
      // Execute query
      const result = await query(queryText, queryParams);
      
      // Get total count for pagination
      let countQueryText = `
        SELECT COUNT(*) 
        FROM job_applications
        WHERE job_seeker_id = $1
      `;
      
      // Add status filter to count query if provided
      if (filters.status) {
        countQueryText += ` AND status = $2`;
      }
      
      const countParams = filters.status ? [jobSeekerId, filters.status] : [jobSeekerId];
      const countResult = await query(countQueryText, countParams);
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        applications: result.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding applications by job seeker', { error, jobSeekerId });
      throw error;
    }
  }
}