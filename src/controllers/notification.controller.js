const Notification = require('../models/notification.model');
const { ApiError } = require('../middlewares/errorHandler');
const { successResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

/**
 * Get user notifications
 * @route GET /api/notifications
 * @access Private
 */
exports.getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const onlyUnread = req.query.unread === 'true';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await Notification.findByUser(userId, onlyUnread, page, limit);
    
    return successResponse(
      res, 
      200, 
      'Notifications retrieved successfully', 
      result.notifications,
      result.pagination
    );
  } catch (error) {
    logger.error('Error getting user notifications', { error });
    return next(error);
  }
};

/**
 * Get unread notification count
 * @route GET /api/notifications/count
 * @access Private
 */
exports.getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const count = await Notification.getUnreadCount(userId);
    
    return successResponse(
      res, 
      200, 
      'Unread count retrieved successfully', 
      { count }
    );
  } catch (error) {
    logger.error('Error getting unread count', { error });
    return next(error);
  }
};

/**
 * Mark notification as read
 * @route PATCH /api/notifications/:id/read
 * @access Private
 */
exports.markAsRead = async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id;
    
    // Check if notification belongs to user
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return next(new ApiError(404, 'Notification not found'));
    }
    
    if (notification.user_id !== userId) {
      return next(new ApiError(403, 'Not authorized to access this notification'));
    }
    
    const updatedNotification = await Notification.markAsRead(notificationId);
    
    return successResponse(
      res, 
      200, 
      'Notification marked as read', 
      updatedNotification
    );
  } catch (error) {
    logger.error('Error marking notification as read', { error, id: req.params.id });
    return next(error);
  }
};

/**
 * Mark all notifications as read
 * @route PATCH /api/notifications/read-all
 * @access Private
 */
exports.markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updatedIds = await Notification.markAllAsRead(userId);
    
    return successResponse(
      res, 
      200, 
      'All notifications marked as read', 
      { updatedIds }
    );
  } catch (error) {
    logger.error('Error marking all notifications as read', { error });
    return next(error);
  }
};

/**
 * Delete notification
 * @route DELETE /api/notifications/:id
 * @access Private
 */
exports.deleteNotification = async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id;
    
    // Check if notification belongs to user
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return next(new ApiError(404, 'Notification not found'));
    }
    
    if (notification.user_id !== userId) {
      return next(new ApiError(403, 'Not authorized to delete this notification'));
    }
    
    await Notification.delete(notificationId);
    
    return successResponse(
      res, 
      200, 
      'Notification deleted successfully'
    );
  } catch (error) {
    logger.error('Error deleting notification', { error, id: req.params.id });
    return next(error);
  }
};