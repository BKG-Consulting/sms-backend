const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const auditController = require('../controllers/auditController');

const router = express.Router();

// POST /api/audits/:auditId/plan/pdf
router.post('/audits/:auditId/plan/pdf', authenticateToken, auditController.generateAuditPlanPdf);

// GET /api/audit-plans/pdfs
router.get('/audit-plans/pdfs', authenticateToken, auditController.getAllAuditPlanPdfs);

module.exports = router;
