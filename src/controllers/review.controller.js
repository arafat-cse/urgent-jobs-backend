const Review = require('../models/review.model');
const { ApiError } = require('../middlewares/errorHandler');
const { successResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');
const Notification = require('../models/notification.model');

/**
 * Create a new review
 * @route POST /api/reviews
 * @access Private
 */
exports.createReview = async (req, res, next) => {
  try {
    const { revieweeId, jobId, rating, comment } = req.body;
    const reviewerId = req.user.id;
    
    // Check if reviewer can review this user for this job
    const canReviewCheck = await Review.canReview(reviewerId, revieweeId, jobId);
    
    if (!canReviewCheck.canReview) {
      let errorMessage = 'You cannot review this user for this job.';
      
      if (canReviewCheck.reason === 'already_reviewed') {
        errorMessage = 'You have already reviewed this user for this job.';
      } else if (canReviewCheck.reason === 'no_accepted_application') {
        errorMessage = 'You can only review users after completing a job together.';
      }
      
      return next(new ApiError(400, errorMessage));
    }
    
    // Create review
    const reviewData = { reviewerId, revieweeId, jobId, rating, comment };
    const review = await Review.create(reviewData);
    
    // Send notification to the reviewee
    try {
      await Notification.createReviewNotification(review, revieweeId);
    } catch (notificationError) {
      // Log but don't fail the request if notification creation fails
      logger.error('Error creating review notification', { 
        error: notificationError,
        reviewId: review.id
      });
    }
    
    return successResponse(
      res, 
      201, 
      'Review created successfully', 
      review
    );
  } catch (error) {
    logger.error('Error creating review', { error });
    return next(error);
  }
};

/**
 * Get review by ID
 * @route GET /api/reviews/:id
 * @access Public
 */
exports.getReviewById = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    
    if (!review) {
      return next(new ApiError(404, 'Review not found'));
    }
    
    return successResponse(
      res, 
      200, 
      'Review retrieved successfully', 
      review
    );
  } catch (error) {
    logger.error('Error getting review', { error, id: req.params.id });
    return next(error);
  }
};

/**
 * Update review
 * @route PUT /api/reviews/:id
 * @access Private (Review owner only)
 */
exports.updateReview = async (req, res, next) => {
  try {
    const reviewId = req.params.id;
    const { rating, comment } = req.body;
    
    // Check if review exists and belongs to user
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return next(new ApiError(404, 'Review not found'));
    }
    
    if (review.reviewer_id !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError(403, 'You can only update your own reviews'));
    }
    
    // Update review
    const updateData = { rating, comment };
    const updatedReview = await Review.update(reviewId, updateData);
    
    return successResponse(
      res, 
      200, 
      'Review updated successfully', 
      updatedReview
    );
  } catch (error) {
    logger.error('Error updating review', { error, id: req.params.id });
    return next(error);
  }
};

/**
 * Delete review
 * @route DELETE /api/reviews/:id
 * @access Private (Review owner or admin)
 */
exports.deleteReview = async (req, res, next) => {
  try {
    const reviewId = req.params.id;
    
    // Check if review exists and belongs to user
    const review = await Review.findById(reviewId);
    
    if (!review) {
      return next(new ApiError(404, 'Review not found'));
    }
    
    if (review.reviewer_id !== req.user.id && req.user.role !== 'admin') {
      return next(new ApiError(403, 'You can only delete your own reviews'));
    }
    
    // Delete review
    await Review.delete(reviewId);
    
    return successResponse(
      res, 
      200, 
      'Review deleted successfully'
    );
  } catch (error) {
    logger.error('Error deleting review', { error, id: req.params.id });
    return next(error);
  }
};

/**
 * Get reviews for a user
 * @route GET /api/reviews/user/:userId
 * @access Public
 */
exports.getUserReviews = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const asReviewee = req.query.type !== 'given';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await Review.findByUser(userId, asReviewee, page, limit);
    
    return successResponse(
      res, 
      200, 
      'User reviews retrieved successfully', 
      result.reviews,
      result.pagination
    );
  } catch (error) {
    logger.error('Error getting user reviews', { error, userId: req.params.userId });
    return next(error);
  }
};

/**
 * Get reviews for a job
 * @route GET /api/reviews/job/:jobId
 * @access Public
 */
exports.getJobReviews = async (req, res, next) => {
  try {
    const jobId = req.params.jobId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await Review.findByJob(jobId, page, limit);
    
    return successResponse(
      res, 
      200, 
      'Job reviews retrieved successfully', 
      result.reviews,
      result.pagination
    );
  } catch (error) {
    logger.error('Error getting job reviews', { error, jobId: req.params.jobId });
    return next(error);
  }
};

/**
 * Get average rating for a user
 * @route GET /api/reviews/user/:userId/rating
 * @access Public
 */
exports.getUserRating = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const rating = await Review.getAverageRating(userId);
    
    return successResponse(
      res, 
      200, 
      'User rating retrieved successfully', 
      rating
    );
  } catch (error) {
    logger.error('Error getting user rating', { error, userId: req.params.userId });
    return next(error);
  }
};