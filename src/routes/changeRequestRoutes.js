const express = require('express');
const router = express.Router();
const changeRequestController = require('../controllers/changeRequest.controller');
const { authenticateToken, restrictTo } = require('../middleware/authMiddleware');
const upload = require('../middleware/multer');

// Get all change requests (filtered by user role)
router.get('/', authenticateToken, changeRequestController.getChangeRequests);

// Get specific change request
router.get('/:id', authenticateToken, changeRequestController.getChangeRequest);

// Approve change request (permission-based)
router.patch('/:id/approve', authenticateToken, changeRequestController.approveChangeRequest);

// Reject change request (permission-based)
router.patch('/:id/reject', authenticateToken, changeRequestController.rejectChangeRequest);

// Verify change request (permission-based)
router.patch('/:id/verify', authenticateToken, changeRequestController.verifyChangeRequest);

// Apply approved change request (permission-based)
router.patch('/:id/apply', authenticateToken, upload.single('file'), changeRequestController.applyChangeRequest);

module.exports = router; 