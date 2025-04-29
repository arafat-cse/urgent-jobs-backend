const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/user.controller');
const { protect, authorize } = require('../middlewares/authMiddleware');
const validationMiddleware = require('../middlewares/validationMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Validation rules
const basicInfoValidation = [
  body('firstName').optional().isString().withMessage('First name must be a string'),
  body('lastName').optional().isString().withMessage('Last name must be a string'),
  body('phone').optional().isString().withMessage('Phone must be a string'),
  body('profilePicture').optional().isString().withMessage('Profile picture must be a string URL')
];

const jobSeekerProfileValidation = [
  body('bio').optional().isString(),
  body('skills').optional().isArray().withMessage('Skills must be an array'),
  body('experienceYears').optional().isInt().withMessage('Experience years must be an integer'),
  body('education').optional().isString(),
  body('availability').optional().isString(),
  body('locationLatitude').optional().isNumeric(),
  body('locationLongitude').optional().isNumeric(),
  body('locationAddress').optional().isString()
];

const employerProfileValidation = [
  body('companyName').optional().isString(),
  body('companyDescription').optional().isString(),
  body('companyWebsite').optional().isURL().withMessage('Company website must be a valid URL'),
  body('companyLogo').optional().isString(),
  body('industry').optional().isString(),
  body('locationLatitude').optional().isNumeric(),
  body('locationLongitude').optional().isNumeric(),
  body('locationAddress').optional().isString()
];

// Routes
router.get('/profile', userController.getUserProfile);

router.put(
  '/profile/basic',
  basicInfoValidation,
  validationMiddleware,
  userController.updateBasicInfo
);

router.put(
  '/profile/job-seeker',
  authorize('job_seeker'),
  jobSeekerProfileValidation,
  validationMiddleware,
  userController.updateJobSeekerProfile
);

router.put(
  '/profile/employer',
  authorize('employer'),
  employerProfileValidation,
  validationMiddleware,
  userController.updateEmployerProfile
);

router.get('/dashboard', userController.getDashboardStats);

module.exports = router;