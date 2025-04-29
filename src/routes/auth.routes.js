const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { protect } = require('../middlewares/authMiddleware');
const validationMiddleware = require('../middlewares/validationMiddleware');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role')
    .isIn(['job_seeker', 'employer'])
    .withMessage('Role must be either job_seeker or employer'),
  body('companyName')
    .if(body('role').equals('employer'))
    .notEmpty()
    .withMessage('Company name is required for employers')
];

const loginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
];

const passwordUpdateValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
];

// Routes
router.post(
  '/register',
  registerValidation,
  validationMiddleware,
  authController.register
);

router.post(
  '/login',
  loginValidation,
  validationMiddleware,
  authController.login
);

router.get('/me', protect, authController.getMe);

router.put(
  '/password',
  protect,
  passwordUpdateValidation,
  validationMiddleware,
  authController.updatePassword
);

module.exports = router;