const express = require('express');
const router = express.Router();
const auditAnalysisController = require('../controllers/auditAnalysisController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Legacy routes (existing)
// Save or update audit analysis
router.post('/', authenticateToken, auditAnalysisController.saveAuditAnalysis);
// Get audit analysis by auditId and department
router.get('/', authenticateToken, auditAnalysisController.getAuditAnalysis);

// New comprehensive analysis routes
// Get comprehensive analysis (with departmentId query param)
router.get('/comprehensive', authenticateToken, auditAnalysisController.getComprehensiveAnalysis);
// Save comprehensive analysis
router.post('/comprehensive', authenticateToken, auditAnalysisController.saveComprehensiveAnalysis);

// Get detailed findings for analysis generation
router.get('/:auditId/detailed-findings', authenticateToken, auditAnalysisController.getDetailedFindings);

// Public viewing endpoint for completed analyses
router.get('/:auditId/view', auditAnalysisController.getAnalysisForViewing);

// Check workflow status for analysis availability
router.get('/workflow-status', authenticateToken, auditAnalysisController.getWorkflowStatus);

module.exports = router; 