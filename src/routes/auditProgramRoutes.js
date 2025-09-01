const express = require('express');
const router = express.Router();
const auditProgramController = require('../controllers/auditProgramController');
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  requireAuditProgramCreatePermission,
  requireAuditProgramReadPermission,
  requireAuditProgramUpdatePermission,
  requireAuditProgramDeletePermission,
  requireAuditProgramCommitPermission,
  requireAuditProgramApprovePermission,
  requireAuditProgramRejectPermission,
  requireAuditProgramExportPermission,
  requireAuditProgramManagePermission
} = require('../middleware/auditProgramPermissionMiddleware');

// Create audit program
router.post('/', 
  authenticateToken, 
  requireAuditProgramCreatePermission,
  auditProgramController.createAuditProgram
);

// Get audit programs by tenant
router.get('/', 
  authenticateToken, 
  requireAuditProgramReadPermission,
  auditProgramController.getAuditProgramsByTenant
);

// Get audit program by ID
router.get('/:programId', 
  authenticateToken, 
  requireAuditProgramReadPermission,
  auditProgramController.getAuditProgramById
);

// Update audit program
router.put('/:programId', 
  authenticateToken, 
  requireAuditProgramUpdatePermission,
  auditProgramController.updateAuditProgram
);

// Delete audit program
router.delete('/:programId', 
  authenticateToken, 
  requireAuditProgramDeletePermission,
  auditProgramController.deleteAuditProgram
);

// Commit audit program for review
router.post('/:programId/commit', 
  authenticateToken, 
  requireAuditProgramCommitPermission,
  auditProgramController.commitAuditProgram
);

// Approve audit program
router.post('/:programId/approve', 
  authenticateToken, 
  requireAuditProgramApprovePermission,
  auditProgramController.approveAuditProgram
);

// Reject audit program
router.post('/:programId/reject', 
  authenticateToken, 
  requireAuditProgramRejectPermission,
  auditProgramController.rejectAuditProgram
);

// Get audit program history
router.get('/:programId/history', 
  authenticateToken, 
  requireAuditProgramReadPermission,
  auditProgramController.getAuditProgramHistory
);

// Export audit program data
router.get('/:programId/export', 
  authenticateToken, 
  requireAuditProgramExportPermission,
  auditProgramController.exportAuditProgram
);

// Get audit program statistics
router.get('/stats/overview', 
  authenticateToken, 
  requireAuditProgramReadPermission,
  auditProgramController.getAuditProgramStats
);

module.exports = router;
