const { query } = require('../db/connection');
const logger = require('../utils/logger');

/**
 * Review model encapsulating database operations for reviews
 */
module.exports = class Review {
  /**
   * Create a new review
   * @param {Object} reviewData - Review data
   */
  static async create(reviewData) {
    try {
      const { reviewerId, revieweeId, jobId, rating, comment } = reviewData;

      const result = await query(
        `INSERT INTO reviews (
          reviewer_id, reviewee_id, job_id, rating, comment
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [reviewerId, revieweeId, jobId, rating, comment]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating review', { error });
      throw error;
    }
  }

  /**
   * Find review by ID
   * @param {Number} id - Review ID
   */
  static async findById(id) {
    try {
      const result = await query(
        `SELECT r.*,
         reviewer.first_name as reviewer_first_name,
         reviewer.last_name as reviewer_last_name,
         reviewer.profile_picture as reviewer_profile_picture,
         reviewer.role as reviewer_role,
         reviewee.first_name as reviewee_first_name,
         reviewee.last_name as reviewee_last_name,
         reviewee.profile_picture as reviewee_profile_picture,
         reviewee.role as reviewee_role,
         j.title as job_title
         FROM reviews r
         JOIN users reviewer ON r.reviewer_id = reviewer.id
         JOIN users reviewee ON r.reviewee_id = reviewee.id
         LEFT JOIN jobs j ON r.job_id = j.id
         WHERE r.id = $1`,
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding review by ID', { error, id });
      throw error;
    }
  }

  /**
   * Update review
   * @param {Number} id - Review ID
   * @param {Object} updateData - Data to update
   */
  static async update(id, updateData) {
    try {
      const { rating, comment } = updateData;

      const result = await query(
        `UPDATE reviews
         SET rating = $1,
             comment = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [rating, comment, id]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error updating review', { error, id });
      throw error;
    }
  }

  /**
   * Delete review by ID
   * @param {Number} id - Review ID
   */
  static async delete(id) {
    try {
      await query('DELETE FROM reviews WHERE id = $1', [id]);
      return true;
    } catch (error) {
      logger.error('Error deleting review', { error, id });
      throw error;
    }
  }

  /**
   * Get reviews for a user
   * @param {Number} userId - User ID
   * @param {Boolean} asReviewee - Get reviews as reviewee (true) or as reviewer (false)
   * @param {Number} page - Page number
   * @param {Number} limit - Items per page
   */
  static async findByUser(userId, asReviewee = true, page = 1, limit = 10) {
    try {
      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Query based on role (reviewee or reviewer)
      const field = asReviewee ? 'reviewee_id' : 'reviewer_id';

      const reviewsResult = await query(
        `SELECT r.*,
         reviewer.first_name as reviewer_first_name,
         reviewer.last_name as reviewer_last_name,
         reviewer.profile_picture as reviewer_profile_picture,
         reviewer.role as reviewer_role,
         reviewee.first_name as reviewee_first_name,
         reviewee.last_name as reviewee_last_name,
         reviewee.profile_picture as reviewee_profile_picture,
         reviewee.role as reviewee_role,
         j.title as job_title
         FROM reviews r
         JOIN users reviewer ON r.reviewer_id = reviewer.id
         JOIN users reviewee ON r.reviewee_id = reviewee.id
         LEFT JOIN jobs j ON r.job_id = j.id
         WHERE r.${field} = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      // Get total count for pagination
      const countResult = await query(
        `SELECT COUNT(*) FROM reviews WHERE ${field} = $1`,
        [userId]
      );

      const totalCount = parseInt(countResult.rows[0].count);

      return {
        reviews: reviewsResult.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding reviews by user', { error, userId, asReviewee });
      throw error;
    }
  }

  /**
   * Get reviews for a job
   * @param {Number} jobId - Job ID
   * @param {Number} page - Page number
   * @param {Number} limit - Items per page
   */
  static async findByJob(jobId, page = 1, limit = 10) {
    try {
      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      const reviewsResult = await query(
        `SELECT r.*,
         reviewer.first_name as reviewer_first_name,
         reviewer.last_name as reviewer_last_name,
         reviewer.profile_picture as reviewer_profile_picture,
         reviewer.role as reviewer_role,
         reviewee.first_name as reviewee_first_name,
         reviewee.last_name as reviewee_last_name,
         reviewee.profile_picture as reviewee_profile_picture,
         reviewee.role as reviewee_role
         FROM reviews r
         JOIN users reviewer ON r.reviewer_id = reviewer.id
         JOIN users reviewee ON r.reviewee_id = reviewee.id
         WHERE r.job_id = $1
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [jobId, limit, offset]
      );

      // Get total count for pagination
      const countResult = await query(
        'SELECT COUNT(*) FROM reviews WHERE job_id = $1',
        [jobId]
      );

      const totalCount = parseInt(countResult.rows[0].count);

      return {
        reviews: reviewsResult.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding reviews by job', { error, jobId });
      throw error;
    }
  }

  /**
   * Check if a user can review another user for a job
   * @param {Number} reviewerId - Reviewer user ID
   * @param {Number} revieweeId - Reviewee user ID
   * @param {Number} jobId - Job ID
   */
  static async canReview(reviewerId, revieweeId, jobId) {
    try {
      // Check if there's already a review
      const existingReviewResult = await query(
        'SELECT id FROM reviews WHERE reviewer_id = $1 AND reviewee_id = $2 AND job_id = $3',
        [reviewerId, revieweeId, jobId]
      );

      if (existingReviewResult.rows.length > 0) {
        return { canReview: false, reason: 'already_reviewed' };
      }

      // Check if job application exists and was accepted
      const applicationResult = await query(
        `SELECT ja.id
         FROM job_applications ja
         JOIN jobs j ON ja.job_id = j.id
         JOIN employer_profiles ep ON j.employer_id = ep.id
         JOIN job_seeker_profiles jsp ON ja.job_seeker_id = jsp.id
         WHERE j.id = $1
         AND (
           (ep.user_id = $2 AND jsp.user_id = $3)
           OR
           (ep.user_id = $3 AND jsp.user_id = $2)
         )
         AND ja.status = 'accepted'`,
        [jobId, reviewerId, revieweeId]
      );

      if (applicationResult.rows.length === 0) {
        return { canReview: false, reason: 'no_accepted_application' };
      }

      return { canReview: true };
    } catch (error) {
      logger.error('Error checking if user can review', { 
        error, 
        reviewerId, 
        revieweeId, 
        jobId 
      });
      throw error;
    }
  }

  /**
   * Get average rating for a user
   * @param {Number} userId - User ID
   */
  static async getAverageRating(userId) {
    try {
      const result = await query(
        `SELECT
          COUNT(*) as total_reviews,
          AVG(rating) as average_rating,
          SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
          SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
          SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
          SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
          SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
         FROM reviews
         WHERE reviewee_id = $1`,
        [userId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting average rating', { error, userId });
      throw error;
    }
  }
};