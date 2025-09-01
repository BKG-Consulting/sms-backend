const express = require('express');
const router = express.Router();
const correctiveActionController = require('../controllers/correctiveActionController');
const { authenticateToken } = require('../middleware/authMiddleware');


// Commit correction requirement (auditor)
router.post('/:id/commit-correction-requirement', authenticateToken, correctiveActionController.commitCorrectionRequirement);

// Create corrective action for a non-conformity (if not exists)
router.post('/non-conformities/:nonConformityId/corrective-actions', authenticateToken, correctiveActionController.createCorrectiveActionForNonConformity);

// Get corrective action by ID
router.get('/:id', authenticateToken, correctiveActionController.getCorrectiveActionById);

// Update corrective action (e.g., for root cause analysis)
router.put('/:id', authenticateToken, correctiveActionController.updateCorrectiveAction);

// Update appropriateness review (auditor)
router.post('/:id/appropriateness-review', authenticateToken, correctiveActionController.submitAppropriatenessReview);

// Update follow up action (auditor)
router.post('/:id/follow-up-action', authenticateToken, correctiveActionController.submitFollowUpAction);

// Update action effectiveness (auditor)
router.post('/:id/action-effectiveness', authenticateToken, correctiveActionController.submitActionEffectiveness);

// Add after other routes
router.post('/:id/notify-mr', authenticateToken, correctiveActionController.notifyMR);

// Debug endpoint for troubleshooting notification issues
router.get('/:id/debug-notifications', authenticateToken, correctiveActionController.debugNotificationIssues);

module.exports = router; 