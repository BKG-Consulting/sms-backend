const express = require('express');
const { authenticateToken, restrictTo } = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');
const router = express.Router();

// Admin dashboard metrics (SUPER_ADMIN and SYSTEM_ADMIN)
router.get('/metrics', authenticateToken, restrictTo(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'Principal', 'HOD', 'HOD AUDITOR']), dashboardController.getDashboardMetrics);

// System admin dashboard metrics (SYSTEM_ADMIN only)
router.get('/system-admin', authenticateToken, restrictTo(['SYSTEM_ADMIN', 'Principal', 'HOD', 'HOD AUDITOR']), dashboardController.getSystemAdminDashboard);

// Chart data endpoints (SUPER_ADMIN and SYSTEM_ADMIN)
router.get('/user-growth', authenticateToken, restrictTo(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'Principal', 'HOD', 'HOD AUDITOR']), dashboardController.getUserGrowthData);
router.get('/tenant-activity', authenticateToken, restrictTo(['SUPER_ADMIN', 'SYSTEM_ADMIN', 'Principal', 'HOD', 'HOD AUDITOR']), dashboardController.getTenantActivityData);

// System admin chart data endpoints (SYSTEM_ADMIN only)
router.get('/system-admin/user-growth', authenticateToken, restrictTo(['SYSTEM_ADMIN', 'Principal', 'HOD', 'HOD AUDITOR']), dashboardController.getSystemAdminUserGrowthData);
router.get('/system-admin/department-activity', authenticateToken, restrictTo(['SYSTEM_ADMIN', 'Principal', 'HOD', 'HOD AUDITOR']), dashboardController.getSystemAdminDepartmentActivityData);

// MR dashboard endpoints (MR role only) - TEMPORARILY REMOVED PERMISSION CHECK
router.get('/mr', authenticateToken, dashboardController.getMRDashboard);
router.get('/mr/audit-program-growth', authenticateToken, dashboardController.getMRAuditProgramGrowthData);
router.get('/mr/audit-activity', authenticateToken, dashboardController.getMRAuditActivityData);
router.get('/mr/document-activity', authenticateToken, dashboardController.getMRDocumentActivityData);

// Auditor dashboard endpoints (AUDITOR and HOD AUDITOR roles)
router.get('/auditor', authenticateToken, restrictTo(['AUDITOR', 'HOD AUDITOR']), dashboardController.getAuditorDashboard);
router.get('/auditor/assignments', authenticateToken, restrictTo(['AUDITOR', 'HOD AUDITOR']), dashboardController.getAuditorAssignments);
router.get('/auditor/findings', authenticateToken, restrictTo(['AUDITOR', 'HOD AUDITOR']), dashboardController.getAuditorFindings);
router.get('/auditor/corrective-actions', authenticateToken, restrictTo(['AUDITOR', 'HOD AUDITOR']), dashboardController.getAuditorCorrectiveActions);
router.get('/auditor/checklists', authenticateToken, restrictTo(['AUDITOR', 'HOD AUDITOR']), dashboardController.getAuditorChecklists);
router.get('/auditor/planning-meetings', authenticateToken, restrictTo(['AUDITOR', 'HOD AUDITOR']), dashboardController.getAuditorPlanningMeetings);

// Get specific tenant details - only accessible by SUPER_ADMIN
router.get('/tenants/:tenantId', authenticateToken, restrictTo(['SUPER_ADMIN']), dashboardController.getTenantDetails);

module.exports = router; 