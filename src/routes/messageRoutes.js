const express = require('express');
const router = express.Router();
const { 
  sendMessage, 
  listMessages, 
  markAsRead, 
  markAsUnread,
  starMessage, 
  archiveMessage, 
  deleteMessage,
  getGeneralAuditNotificationDate,
  sendManagementReviewInvitation
} = require('../controllers/messageController');
const { authenticateToken } = require('../middleware/authMiddleware');
const multer = require('multer');
const upload = multer(); // In-memory storage, adjust as needed

router.post('/', authenticateToken, upload.array('attachments'), sendMessage);
router.post('/management-review-invitation', authenticateToken, sendManagementReviewInvitation);
router.get('/', authenticateToken, listMessages);
router.patch('/:id/read', authenticateToken, markAsRead);
router.patch('/:id/unread', authenticateToken, markAsUnread);
router.patch('/:id/star', authenticateToken, starMessage);
router.patch('/:id/archive', authenticateToken, archiveMessage);
router.delete('/:id', authenticateToken, deleteMessage);
router.get('/general-audit-notification-date/:auditId', authenticateToken, getGeneralAuditNotificationDate);

module.exports = router; 