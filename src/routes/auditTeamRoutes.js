const express = require('express');
const { authenticateToken, restrictTo } = require('../middleware/authMiddleware');
const auditController = require('../controllers/auditController');
const router = express.Router({ mergeParams: true });

const ROLES = ['SYSTEM_ADMIN', 'MR'];

// Add or update a team member's role
router.put('/:userId', authenticateToken, restrictTo(ROLES), auditController.addOrUpdateTeamMember);

// Remove a team member
router.delete('/:userId', authenticateToken, restrictTo(ROLES), auditController.removeTeamMember);

// Team member responds to appointment (accept/decline)
router.patch('/:userId/respond', authenticateToken, auditController.respondToTeamAppointment);

module.exports = router;