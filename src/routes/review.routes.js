const express = require('express');
const { body } = require('express-validator');
const reviewController = require('../controllers/review.controller');
const { protect } = require('../middlewares/authMiddleware');
const validationMiddleware = require('../middlewares/validationMiddleware');

const router = express.Router();

// Validation rules
const createReviewValidation = [
  body('revieweeId').isInt().withMessage('Valid reviewee ID is required'),
  body('jobId').isInt().withMessage('Valid job ID is required'),
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment').notEmpty().withMessage('Comment is required')
];

const updateReviewValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment').notEmpty().withMessage('Comment is required')
];

// Public routes
router.get('/user/:userId', reviewController.getUserReviews);
router.get('/user/:userId/rating', reviewController.getUserRating);
router.get('/job/:jobId', reviewController.getJobReviews);
router.get('/:id', reviewController.getReviewById);

// Protected routes
router.use(protect);

router.post(
  '/',
  createReviewValidation,
  validationMiddleware,
  reviewController.createReview
);

router.put(
  '/:id',
  updateReviewValidation,
  validationMiddleware,
  reviewController.updateReview
);

router.delete('/:id', reviewController.deleteReview);

module.exports = router;