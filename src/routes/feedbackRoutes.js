const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const feedbackController = require('../controllers/feedbackController');
const router = express.Router();

router.post('/', authenticateToken, feedbackController.createFeedback);
router.get('/', authenticateToken, feedbackController.getFeedbacks);
router.get('/:id', authenticateToken, feedbackController.getFeedbackById);

module.exports = router; 