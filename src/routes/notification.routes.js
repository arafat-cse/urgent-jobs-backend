const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { protect } = require('../middlewares/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Routes
router.get('/', notificationController.getUserNotifications);
router.get('/count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;