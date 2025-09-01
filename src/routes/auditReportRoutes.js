const express = require('express');
const router = express.Router();
const auditReportController = require('../controllers/auditReportController');
const { authenticateToken, requirePermission } = require('../middleware/authMiddleware');

// Get all audit reports for the current tenant
router.get('/', authenticateToken, auditReportController.getAllAuditReports);

// Generate comprehensive audit report
router.get('/:auditId', authenticateToken, auditReportController.generateAuditReport);

// Get audit report statistics
router.get('/:auditId/stats', authenticateToken, auditReportController.getAuditReportStats);

// Get categorization status for progressive report generation
router.get('/:auditId/categorization-status', authenticateToken, auditReportController.getCategorizationStatus);

// Generate partial audit report for specific scopes
router.post('/:auditId/partial', authenticateToken, auditReportController.generatePartialReport);

module.exports = router; 