const User = require('../models/user.model');
const { ApiError } = require('../middlewares/errorHandler');
const { successResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

/**
 * Get user profile
 * @route GET /api/users/profile
 * @access Private
 */
exports.getUserProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userData = await User.findById(userId);
    
    if (!userData) {
      return next(new ApiError(404, 'User profile not found'));
    }
    
    return successResponse(
      res, 
      200, 
      'User profile retrieved successfully', 
      userData
    );
  } catch (error) {
    logger.error('Error getting user profile', { error });
    return next(error);
  }
};

/**
 * Update user basic information
 * @route PUT /api/users/profile/basic
 * @access Private
 */
exports.updateBasicInfo = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Extract basic user data
    const userData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone,
      profilePicture: req.body.profilePicture
    };
    
    const updatedUser = await User.updateBasicInfo(userId, userData);
    
    return successResponse(
      res, 
      200, 
      'Basic info updated successfully', 
      updatedUser
    );
  } catch (error) {
    logger.error('Error updating basic info', { error });
    return next(error);
  }
};

/**
 * Update job seeker profile
 * @route PUT /api/users/profile/job-seeker
 * @access Private (Job seekers only)
 */
exports.updateJobSeekerProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Check if user is a job seeker
    if (req.user.role !== 'job_seeker') {
      return next(new ApiError(403, 'Not authorized to update a job seeker profile'));
    }
    
    // Extract profile data
    const profileData = {
      bio: req.body.bio,
      skills: req.body.skills,
      experienceYears: req.body.experienceYears,
      education: req.body.education,
      availability: req.body.availability,
      locationLatitude: req.body.locationLatitude,
      locationLongitude: req.body.locationLongitude,
      locationAddress: req.body.locationAddress
    };
    
    const updatedProfile = await User.updateJobSeekerProfile(userId, profileData);
    
    return successResponse(
      res, 
      200, 
      'Job seeker profile updated successfully', 
      updatedProfile
    );
  } catch (error) {
    logger.error('Error updating job seeker profile', { error });
    return next(error);
  }
};

/**
 * Update employer profile
 * @route PUT /api/users/profile/employer
 * @access Private (Employers only)
 */
exports.updateEmployerProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Check if user is an employer
    if (req.user.role !== 'employer') {
      return next(new ApiError(403, 'Not authorized to update an employer profile'));
    }
    
    // Extract profile data
    const profileData = {
      companyName: req.body.companyName,
      companyDescription: req.body.companyDescription,
      companyWebsite: req.body.companyWebsite,
      companyLogo: req.body.companyLogo,
      industry: req.body.industry,
      locationLatitude: req.body.locationLatitude,
      locationLongitude: req.body.locationLongitude,
      locationAddress: req.body.locationAddress
    };
    
    const updatedProfile = await User.updateEmployerProfile(userId, profileData);
    
    return successResponse(
      res, 
      200, 
      'Employer profile updated successfully', 
      updatedProfile
    );
  } catch (error) {
    logger.error('Error updating employer profile', { error });
    return next(error);
  }
};

/**
 * Get user dashboard statistics
 * @route GET /api/users/dashboard
 * @access Private
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let stats;
    
    // Get stats based on user role
    if (req.user.role === 'job_seeker') {
      stats = await User.getJobSeekerStats(userId);
    } else if (req.user.role === 'employer') {
      stats = await User.getEmployerStats(userId);
    } else {
      return next(new ApiError(403, 'Dashboard stats not available for this user role'));
    }
    
    return successResponse(
      res, 
      200, 
      'Dashboard statistics retrieved successfully', 
      stats
    );
  } catch (error) {
    logger.error('Error getting dashboard stats', { error });
    return next(error);
  }
};