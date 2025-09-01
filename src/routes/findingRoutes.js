const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const findingController = require('../controllers/findingController');
const { authenticateToken, requirePermission } = require('../middleware/authMiddleware');

// Create finding for an audit
router.post('/audits/:auditId/findings', authenticateToken, requirePermission('auditFinding', 'create'), findingController.createFinding);
// Get all findings for an audit
router.get('/audits/:auditId/findings', authenticateToken, requirePermission('auditFinding', 'read'), findingController.getFindingsByAudit);
// Get finding by ID
router.get('/findings/:findingId', authenticateToken, requirePermission('auditFinding', 'read'), findingController.getFindingById);
// Update finding
router.put('/findings/:findingId', authenticateToken, requirePermission('auditFinding', 'update'), findingController.updateFinding);
// Delete finding
router.delete('/findings/:findingId', authenticateToken, requirePermission('auditFinding', 'delete'), findingController.deleteFinding);
// Commit findings for an audit
router.post('/audits/:auditId/commit', authenticateToken, requirePermission('auditFinding', 'update'), findingController.commitFindings);
// HOD review of a finding (no permission check needed - users routed from notifications)
router.put('/findings/:findingId/hod-review', authenticateToken, findingController.hodReviewFinding);
// HOD finish findings review (no permission check needed - users routed from notifications)
router.post('/finish-review', authenticateToken, findingController.finishFindingsReview);
// Finish categorization (notify MR)
router.post('/finish-categorization', authenticateToken, requirePermission('auditFinding', 'update'), findingController.finishCategorization);
// Global findings with filters
router.get('/global', authenticateToken, requirePermission('auditFinding', 'read'), findingController.getGlobalFindings);
// Fetch all non-conformities
router.get('/non-conformities', authenticateToken, requirePermission('auditFinding', 'read'), findingController.getNonConformities);
// Get non-conformity by ID
router.get('/non-conformities/:id', authenticateToken, requirePermission('auditFinding', 'read'), findingController.getNonConformityById);
// Update non-conformity classification (type and severity)
router.put('/non-conformities/:id', authenticateToken, requirePermission('auditFinding', 'update'), findingController.updateNonConformity);

// --- Finding Security Endpoints ---
router.get('/findings/:findingId/validate-access/:userId', authenticateToken, requirePermission('auditFinding', 'read'), findingController.validateFindingAccess);

module.exports = router; 