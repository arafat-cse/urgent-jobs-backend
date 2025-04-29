const express = require('express');
const { body } = require('express-validator');
const applicationController = require('../controllers/application.controller');
const { protect, authorize } = require('../middlewares/authMiddleware');
const validationMiddleware = require('../middlewares/validationMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Validation rules
const applyJobValidation = [
  body('jobId').isInt().withMessage('Valid job ID is required'),
  body('coverLetter').optional()
];

const updateStatusValidation = [
  body('status')
    .isIn(['pending', 'accepted', 'rejected', 'withdrawn'])
    .withMessage('Status must be pending, accepted, rejected, or withdrawn')
];

// Routes
router.post(
  '/',
  authorize('job_seeker'),
  applyJobValidation,
  validationMiddleware,
  applicationController.applyForJob
);

router.get(
  '/me',
  authorize('job_seeker'),
  applicationController.getMyApplications
);

router.get(
  '/job/:jobId',
  authorize('employer'),
  applicationController.getJobApplications
);

router.get(
  '/:id',
  applicationController.getApplicationById
);

router.patch(
  '/:id/status',
  updateStatusValidation,
  validationMiddleware,
  applicationController.updateApplicationStatus
);

module.exports = router;