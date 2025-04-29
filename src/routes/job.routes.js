const express = require('express');
const { body } = require('express-validator');
const jobController = require('../controllers/job.controller');
const { protect, authorize } = require('../middlewares/authMiddleware');
const validationMiddleware = require('../middlewares/validationMiddleware');

const router = express.Router();

// Validation rules
const createJobValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('payAmount')
    .isNumeric()
    .withMessage('Pay amount must be a number'),
  body('payType')
    .isIn(['hourly', 'fixed', 'daily'])
    .withMessage('Pay type must be hourly, fixed, or daily'),
  body('locationAddress').notEmpty().withMessage('Location address is required'),
  body('urgency')
    .isIn(['immediate', 'today', 'this_week', 'flexible'])
    .withMessage('Urgency must be valid'),
  body('category').notEmpty().withMessage('Category is required')
];

const updateJobValidation = [
  body('title').optional(),
  body('payAmount')
    .optional()
    .isNumeric()
    .withMessage('Pay amount must be a number'),
  body('payType')
    .optional()
    .isIn(['hourly', 'fixed', 'daily'])
    .withMessage('Pay type must be hourly, fixed, or daily'),
  body('urgency')
    .optional()
    .isIn(['immediate', 'today', 'this_week', 'flexible'])
    .withMessage('Urgency must be valid'),
  body('status')
    .optional()
    .isIn(['active', 'filled', 'expired', 'draft'])
    .withMessage('Status must be valid')
];

// Public routes
router.get('/', jobController.getJobs);
router.get('/:id', jobController.getJobById);

// Protected routes
router.use(protect);

// Employer routes
router.post(
  '/',
  authorize('employer'),
  createJobValidation,
  validationMiddleware,
  jobController.createJob
);

router.put(
  '/:id',
  authorize('employer'),
  updateJobValidation,
  validationMiddleware,
  jobController.updateJob
);

router.delete(
  '/:id',
  authorize('employer'),
  jobController.deleteJob
);

router.get(
  '/employer/listings',
  authorize('employer'),
  jobController.getEmployerJobs
);

module.exports = router;