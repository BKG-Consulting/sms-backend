const express = require('express');
const router = express.Router();
const preventiveActionController = require('../controllers/preventiveActionController');
const { authenticateToken } = require('../middleware/authMiddleware');

// List all improvement opportunities (must be before any /:id route)
router.get('/opportunities', authenticateToken, preventiveActionController.listImprovementOpportunities);

// Save or update observation requirement
router.post('/:id/observation-requirement', authenticateToken, preventiveActionController.commitObservationRequirement);

// Commit proposed preventive action (potential root cause analysis)
router.post('/:id/proposed-action', authenticateToken, preventiveActionController.commitProposedPreventiveAction);

// Appropriateness review
router.post('/:id/appropriateness-review', authenticateToken, preventiveActionController.submitAppropriatenessReview);
// Follow up action
router.post('/:id/follow-up-action', authenticateToken, preventiveActionController.submitFollowUpAction);
// Action effectiveness
router.post('/:id/action-effectiveness', authenticateToken, preventiveActionController.submitActionEffectiveness);

// Notify MR (Management Representative)
router.post('/:id/notify-mr', authenticateToken, preventiveActionController.notifyMR);

// Get preventive action by ID
router.get('/:id', authenticateToken, preventiveActionController.getPreventiveActionById);

module.exports = router; 