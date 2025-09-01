const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/authMiddleware');
const tenantController = require('../controllers/tenantController');
const router = express.Router();

console.log('tenantController:', tenantController);
console.log('typeof tenantController.createTenant:', typeof tenantController.createTenant);

// Public route to get tenant by domain (for frontend tenant detection)
router.get('/by-domain/:domain', tenantController.getTenantByDomain);

// Protected routes with permissions
router.post('/', authenticateToken, requirePermission('tenant', 'create'), tenantController.createTenant);
router.get('/', authenticateToken, requirePermission('tenant', 'read'), tenantController.getAllTenants);
router.get('/:id', authenticateToken, requirePermission('tenant', 'read'), tenantController.getTenantById);
router.put('/:tenantId', authenticateToken, requirePermission('tenant', 'update'), tenantController.updateTenant);
router.patch('/:tenantId/suspend', authenticateToken, requirePermission('tenant', 'suspend'), tenantController.suspendTenant);
router.delete('/:tenantId', authenticateToken, requirePermission('tenant', 'delete'), tenantController.deleteTenant);
router.get('/:tenantId/details', authenticateToken, requirePermission('tenant', 'read'), tenantController.getInstitutionDetails);

// Branding routes
router.put('/:tenantId/branding', authenticateToken, requirePermission('tenant', 'update'), tenantController.updateTenantBranding);

// User management routes
router.post('/users', authenticateToken, requirePermission('user', 'create'), tenantController.registerUser);
router.put('/:tenantId/users/:userId', authenticateToken, requirePermission('user', 'update'), tenantController.updateUser);
router.delete('/:tenantId/users/:userId', authenticateToken, requirePermission('user', 'delete'), tenantController.deleteUser);
router.get('/:tenantId/users', authenticateToken, tenantController.getUsersForTenant);

// Dashboard-specific routes
router.get('/with-stats', authenticateToken, requirePermission('tenant', 'read'), tenantController.getTenantsWithStats);
router.get('/distribution', authenticateToken, requirePermission('tenant', 'read'), tenantController.getTenantDistribution);
router.get('/:tenantId/analytics', authenticateToken, requirePermission('tenant', 'read'), tenantController.getTenantAnalytics);

// Migration routes for fixing SYSTEM_ADMIN issues
router.post('/fix-system-admin-permissions', authenticateToken, requirePermission('tenant', 'update'), tenantController.fixSystemAdminPermissions);
router.post('/fix-system-admin-login-destinations', authenticateToken, requirePermission('tenant', 'update'), tenantController.fixSystemAdminLoginDestinations);

router.get('/test', (req, res) => res.send('Tenant route works!'));

module.exports = router;