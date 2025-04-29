const { query } = require('../db/connection');
const logger = require('../utils/logger');

/**
 * Notification model encapsulating database operations for notifications
 */
module.exports = class Notification {
  /**
   * Create a new notification
   * @param {Object} notificationData - Notification data
   */
  static async create(notificationData) {
    try {
      const { userId, title, message, type, relatedId } = notificationData;

      const result = await query(
        `INSERT INTO notifications (
          user_id, title, message, type, related_id
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [userId, title, message, type, relatedId]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating notification', { error });
      throw error;
    }
  }

  /**
   * Find notification by ID
   * @param {Number} id - Notification ID
   */
  static async findById(id) {
    try {
      const result = await query(
        'SELECT * FROM notifications WHERE id = $1',
        [id]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding notification by ID', { error, id });
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * @param {Number} userId - User ID
   * @param {Boolean} onlyUnread - Get only unread notifications
   * @param {Number} page - Page number
   * @param {Number} limit - Items per page
   */
  static async findByUser(userId, onlyUnread = false, page = 1, limit = 10) {
    try {
      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Build query
      let queryText = 'SELECT * FROM notifications WHERE user_id = $1';
      const queryParams = [userId];
      let paramCounter = 2;

      // Filter by read status if needed
      if (onlyUnread) {
        queryText += ' AND is_read = false';
      }

      // Add sorting and pagination
      queryText += ' ORDER BY created_at DESC LIMIT $' + paramCounter + ' OFFSET $' + (paramCounter + 1);
      queryParams.push(limit, offset);

      // Execute query
      const result = await query(queryText, queryParams);

      // Get total count for pagination
      let countQueryText = 'SELECT COUNT(*) FROM notifications WHERE user_id = $1';
      const countParams = [userId];

      if (onlyUnread) {
        countQueryText += ' AND is_read = false';
      }

      const countResult = await query(countQueryText, countParams);
      const totalCount = parseInt(countResult.rows[0].count);

      return {
        notifications: result.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding notifications by user', { error, userId });
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {Number} id - Notification ID
   */
  static async markAsRead(id) {
    try {
      const result = await query(
        'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *',
        [id]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error marking notification as read', { error, id });
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {Number} userId - User ID
   */
  static async markAllAsRead(userId) {
    try {
      const result = await query(
        'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false RETURNING id',
        [userId]
      );

      return result.rows.map(row => row.id);
    } catch (error) {
      logger.error('Error marking all notifications as read', { error, userId });
      throw error;
    }
  }

  /**
   * Delete notification
   * @param {Number} id - Notification ID
   */
  static async delete(id) {
    try {
      await query('DELETE FROM notifications WHERE id = $1', [id]);
      return true;
    } catch (error) {
      logger.error('Error deleting notification', { error, id });
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   * @param {Number} userId - User ID
   */
  static async getUnreadCount(userId) {
    try {
      const result = await query(
        'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
        [userId]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Error getting unread notification count', { error, userId });
      throw error;
    }
  }

  /**
   * Create application status change notification
   * @param {Object} application - Application object
   * @param {String} newStatus - New application status
   * @param {Number} targetUserId - User ID to notify
   */
  static async createApplicationStatusNotification(application, newStatus, targetUserId) {
    try {
      let title, message;

      switch (newStatus) {
        case 'accepted':
          title = 'Application Accepted';
          message = `Your application for ${application.job_title} has been accepted!`;
          break;
        case 'rejected':
          title = 'Application Rejected';
          message = `Your application for ${application.job_title} was not accepted.`;
          break;
        case 'withdrawn':
          title = 'Application Withdrawn';
          message = `An application for ${application.job_title} has been withdrawn.`;
          break;
        default:
          title = 'Application Status Updated';
          message = `Your application status has been updated to ${newStatus}.`;
      }

      return await this.create({
        userId: targetUserId,
        title,
        message,
        type: 'application_status',
        relatedId: application.id
      });
    } catch (error) {
      logger.error('Error creating application status notification', { error });
      throw error;
    }
  }

  /**
   * Create new application notification
   * @param {Object} application - Application object
   * @param {Object} job - Job object
   * @param {Object} jobSeeker - Job seeker object
   * @param {Number} employerId - Employer user ID
   */
  static async createNewApplicationNotification(application, job, jobSeeker, employerId) {
    try {
      const title = 'New Job Application';
      const message = `${jobSeeker.first_name} ${jobSeeker.last_name} has applied for your job: ${job.title}`;

      return await this.create({
        userId: employerId,
        title,
        message,
        type: 'new_application',
        relatedId: application.id
      });
    } catch (error) {
      logger.error('Error creating new application notification', { error });
      throw error;
    }
  }

  /**
   * Create new review notification
   * @param {Object} review - Review object
   * @param {Number} targetUserId - User ID to notify
   */
  static async createReviewNotification(review, targetUserId) {
    try {
      const title = 'New Review Received';
      const message = `You have received a ${review.rating}-star review.`;

      return await this.create({
        userId: targetUserId,
        title,
        message,
        type: 'new_review',
        relatedId: review.id
      });
    } catch (error) {
      logger.error('Error creating new review notification', { error });
      throw error;
    }
  }
};