const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get notifications with filtering and pagination
router.get('/', authenticateToken, notificationController.getNotifications);

// Mark notifications as read
router.post('/read', authenticateToken, notificationController.markNotificationsRead);

// Mark all notifications as read
router.post('/read-all', authenticateToken, notificationController.markAllNotificationsRead);

// Delete a single notification
router.delete('/:notificationId', authenticateToken, notificationController.deleteNotification);

// Delete multiple notifications
router.delete('/delete-multiple', authenticateToken, notificationController.deleteMultipleNotifications);

// Get notification statistics
router.get('/stats', authenticateToken, notificationController.getNotificationStats);

// Broadcast notification to all users (for audit analysis completion)
router.post('/broadcast', authenticateToken, notificationController.broadcastNotification);

module.exports = router; 