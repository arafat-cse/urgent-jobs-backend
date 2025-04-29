const { query } = require('../db/connection');
const logger = require('../utils/logger');

/**
 * User model encapsulating database operations for users
 */
module.exports = class User {
  /**
   * Find user by ID with profile details
   * @param {Number} id - User ID
   */
  static async findById(id) {
    try {
      // First get the user's role
      const userResult = await query(
        'SELECT role FROM users WHERE id = $1',
        [id]
      );
      
      if (userResult.rows.length === 0) {
        return null;
      }
      
      const { role } = userResult.rows[0];
      let userData;
      
      // Get user data based on role
      if (role === 'job_seeker') {
        const result = await query(
          `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.profile_picture,
          jsp.id as profile_id, jsp.bio, jsp.skills, jsp.experience_years, jsp.education, jsp.availability,
          jsp.location_latitude, jsp.location_longitude, jsp.location_address
          FROM users u
          JOIN job_seeker_profiles jsp ON u.id = jsp.user_id
          WHERE u.id = $1`,
          [id]
        );
        
        userData = result.rows[0];
      } else if (role === 'employer') {
        const result = await query(
          `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.profile_picture,
          ep.id as profile_id, ep.company_name, ep.company_description, ep.company_website, 
          ep.company_logo, ep.industry, ep.location_latitude, ep.location_longitude, ep.location_address
          FROM users u
          JOIN employer_profiles ep ON u.id = ep.user_id
          WHERE u.id = $1`,
          [id]
        );
        
        userData = result.rows[0];
      } else {
        // Admin or other roles
        const result = await query(
          `SELECT id, email, first_name, last_name, phone, role, profile_picture
          FROM users 
          WHERE id = $1`,
          [id]
        );
        
        userData = result.rows[0];
      }
      
      return userData;
    } catch (error) {
      logger.error('Error finding user by ID', { error, id });
      throw error;
    }
  }

  /**
   * Update user basic information
   * @param {Number} id - User ID
   * @param {Object} userData - User data to update
   */
  static async updateBasicInfo(id, userData) {
    try {
      const { firstName, lastName, phone, profilePicture } = userData;
      
      const result = await query(
        `UPDATE users
         SET first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             phone = COALESCE($3, phone),
             profile_picture = COALESCE($4, profile_picture),
             updated_at = NOW()
         WHERE id = $5
         RETURNING id, email, first_name, last_name, phone, role, profile_picture`,
        [firstName, lastName, phone, profilePicture, id]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating user basic info', { error, id });
      throw error;
    }
  }

  /**
   * Update job seeker profile
   * @param {Number} userId - User ID
   * @param {Object} profileData - Profile data to update
   */
  static async updateJobSeekerProfile(userId, profileData) {
    try {
      // Get profile ID
      const profileResult = await query(
        'SELECT id FROM job_seeker_profiles WHERE user_id = $1',
        [userId]
      );
      
      if (profileResult.rows.length === 0) {
        throw new Error('Job seeker profile not found');
      }
      
      const profileId = profileResult.rows[0].id;
      
      // Extract profile data
      const {
        bio,
        skills,
        experienceYears,
        education,
        availability,
        locationLatitude,
        locationLongitude,
        locationAddress
      } = profileData;
      
      const result = await query(
        `UPDATE job_seeker_profiles
         SET bio = COALESCE($1, bio),
             skills = COALESCE($2, skills),
             experience_years = COALESCE($3, experience_years),
             education = COALESCE($4, education),
             availability = COALESCE($5, availability),
             location_latitude = COALESCE($6, location_latitude),
             location_longitude = COALESCE($7, location_longitude),
             location_address = COALESCE($8, location_address),
             updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [
          bio,
          skills,
          experienceYears,
          education,
          availability,
          locationLatitude,
          locationLongitude,
          locationAddress,
          profileId
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating job seeker profile', { error, userId });
      throw error;
    }
  }

  /**
   * Update employer profile
   * @param {Number} userId - User ID
   * @param {Object} profileData - Profile data to update
   */
  static async updateEmployerProfile(userId, profileData) {
    try {
      // Get profile ID
      const profileResult = await query(
        'SELECT id FROM employer_profiles WHERE user_id = $1',
        [userId]
      );
      
      if (profileResult.rows.length === 0) {
        throw new Error('Employer profile not found');
      }
      
      const profileId = profileResult.rows[0].id;
      
      // Extract profile data
      const {
        companyName,
        companyDescription,
        companyWebsite,
        companyLogo,
        industry,
        locationLatitude,
        locationLongitude,
        locationAddress
      } = profileData;
      
      const result = await query(
        `UPDATE employer_profiles
         SET company_name = COALESCE($1, company_name),
             company_description = COALESCE($2, company_description),
             company_website = COALESCE($3, company_website),
             company_logo = COALESCE($4, company_logo),
             industry = COALESCE($5, industry),
             location_latitude = COALESCE($6, location_latitude),
             location_longitude = COALESCE($7, location_longitude),
             location_address = COALESCE($8, location_address),
             updated_at = NOW()
         WHERE id = $9
         RETURNING *`,
        [
          companyName,
          companyDescription,
          companyWebsite,
          companyLogo,
          industry,
          locationLatitude,
          locationLongitude,
          locationAddress,
          profileId
        ]
      );
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating employer profile', { error, userId });
      throw error;
    }
  }

  /**
   * Get job seeker dashboard stats
   * @param {Number} userId - User ID
   */
  static async getJobSeekerStats(userId) {
    try {
      // Get job seeker profile ID
      const profileResult = await query(
        'SELECT id FROM job_seeker_profiles WHERE user_id = $1',
        [userId]
      );
      
      if (profileResult.rows.length === 0) {
        throw new Error('Job seeker profile not found');
      }
      
      const profileId = profileResult.rows[0].id;
      
      // Get application stats
      const statsResult = await query(
        `SELECT
          COUNT(*) as total_applications,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_applications,
          SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_applications,
          SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_applications
         FROM job_applications
         WHERE job_seeker_id = $1`,
        [profileId]
      );
      
      // Get recent applications
      const recentApplicationsResult = await query(
        `SELECT ja.id, ja.status, ja.created_at,
         j.title as job_title, j.pay_amount, j.pay_type, j.urgency,
         ep.company_name, ep.company_logo
         FROM job_applications ja
         JOIN jobs j ON ja.job_id = j.id
         JOIN employer_profiles ep ON j.employer_id = ep.id
         WHERE ja.job_seeker_id = $1
         ORDER BY ja.created_at DESC
         LIMIT 5`,
        [profileId]
      );
      
      return {
        stats: statsResult.rows[0],
        recentApplications: recentApplicationsResult.rows
      };
    } catch (error) {
      logger.error('Error getting job seeker stats', { error, userId });
      throw error;
    }
  }

  /**
   * Get employer dashboard stats
   * @param {Number} userId - User ID
   */
  static async getEmployerStats(userId) {
    try {
      // Get employer profile ID
      const profileResult = await query(
        'SELECT id FROM employer_profiles WHERE user_id = $1',
        [userId]
      );
      
      if (profileResult.rows.length === 0) {
        throw new Error('Employer profile not found');
      }
      
      const profileId = profileResult.rows[0].id;
      
      // Get job stats
      const jobStatsResult = await query(
        `SELECT
          COUNT(*) as total_jobs,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_jobs,
          SUM(CASE WHEN status = 'filled' THEN 1 ELSE 0 END) as filled_jobs,
          SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_jobs
         FROM jobs
         WHERE employer_id = $1`,
        [profileId]
      );
      
      // Get application stats
      const applicationStatsResult = await query(
        `SELECT
          COUNT(*) as total_applications,
          SUM(CASE WHEN ja.status = 'pending' THEN 1 ELSE 0 END) as pending_applications,
          SUM(CASE WHEN ja.status = 'accepted' THEN 1 ELSE 0 END) as accepted_applications
         FROM job_applications ja
         JOIN jobs j ON ja.job_id = j.id
         WHERE j.employer_id = $1`,
        [profileId]
      );
      
      // Get recent jobs
      const recentJobsResult = await query(
        `SELECT id, title, status, created_at, pay_amount, pay_type, urgency,
          (SELECT COUNT(*) FROM job_applications WHERE job_id = jobs.id) as application_count
         FROM jobs
         WHERE employer_id = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [profileId]
      );
      
      // Get recent applications
      const recentApplicationsResult = await query(
        `SELECT ja.id, ja.status, ja.created_at,
         j.title as job_title,
         u.first_name, u.last_name, u.profile_picture
         FROM job_applications ja
         JOIN jobs j ON ja.job_id = j.id
         JOIN job_seeker_profiles jsp ON ja.job_seeker_id = jsp.id
         JOIN users u ON jsp.user_id = u.id
         WHERE j.employer_id = $1
         ORDER BY ja.created_at DESC
         LIMIT 5`,
        [profileId]
      );
      
      return {
        jobStats: jobStatsResult.rows[0],
        applicationStats: applicationStatsResult.rows[0],
        recentJobs: recentJobsResult.rows,
        recentApplications: recentApplicationsResult.rows
      };
    } catch (error) {
      logger.error('Error getting employer stats', { error, userId });
      throw error;
    }
  }
};