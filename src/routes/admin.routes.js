const express = require('express');
const router = express.Router();

// Import middleware
const { protect } = require('../middlewares/authMiddleware');
const { ensureAdmin } = require('../middlewares/adminAuth.middleware');

// Import controllers
const dashboardController = require('../controllers/admin/dashboard.controller');
const userController = require('../controllers/admin/user.controller');
const jobController = require('../controllers/admin/job.controller');
const applicationController = require('../controllers/admin/application.controller');
const logController = require('../controllers/admin/log.controller');

// Protect all admin routes with authentication
router.use(protect);
// Ensure user is admin
router.use(ensureAdmin);

// Check if controller methods exist before registering routes
if (dashboardController && dashboardController.getDashboardStats) {
  router.get('/dashboard', dashboardController.getDashboardStats);
} else {
  console.error('Warning: dashboardController.getDashboardStats is undefined');
}

if (userController && userController.getUsers) {
  router.get('/users', userController.getUsers);
} else {
  console.error('Warning: userController.getUsers is undefined');
}

if (userController && userController.getUserById) {
  router.get('/users/:id', userController.getUserById);
} else {
  console.error('Warning: userController.getUserById is undefined');
}

if (userController && userController.updateUserStatus) {
  router.patch('/users/:id/status', userController.updateUserStatus);
} else {
  console.error('Warning: userController.updateUserStatus is undefined');
}

if (jobController && jobController.getJobs) {
  router.get('/jobs', jobController.getJobs);
} else {
  console.error('Warning: jobController.getJobs is undefined');
}

if (jobController && jobController.getJobById) {
  router.get('/jobs/:id', jobController.getJobById);
} else {
  console.error('Warning: jobController.getJobById is undefined');
}

if (jobController && jobController.updateJobStatus) {
  router.patch('/jobs/:id/status', jobController.updateJobStatus);
} else {
  console.error('Warning: jobController.updateJobStatus is undefined');
}

if (jobController && jobController.deleteJob) {
  router.delete('/jobs/:id', jobController.deleteJob);
} else {
  console.error('Warning: jobController.deleteJob is undefined');
}

if (applicationController && applicationController.getApplications) {
  router.get('/applications', applicationController.getApplications);
} else {
  console.error('Warning: applicationController.getApplications is undefined');
}

if (applicationController && applicationController.getApplicationById) {
  router.get('/applications/:id', applicationController.getApplicationById);
} else {
  console.error('Warning: applicationController.getApplicationById is undefined');
}

if (applicationController && applicationController.updateApplicationStatus) {
  router.patch('/applications/:id/status', applicationController.updateApplicationStatus);
} else {
  console.error('Warning: applicationController.updateApplicationStatus is undefined');
}

if (logController && logController.getLogs) {
  router.get('/logs', logController.getLogs);
} else {
  console.error('Warning: logController.getLogs is undefined');
}

module.exports = router;