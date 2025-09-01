const express = require('express');
const router = express.Router();
const userPermissionController = require('../controllers/userPermissionController');
const { authenticateToken, requirePermission } = require('../middleware/authMiddleware');

// Grant a permission to a user
router.post('/grant', authenticateToken, requirePermission('user', 'assign'), userPermissionController.grantPermission);

// Revoke a permission from a user
router.post('/revoke', authenticateToken, requirePermission('user', 'assign'), userPermissionController.revokePermission);

// Remove a user permission entirely
router.delete('/:userId/:permissionId', authenticateToken, requirePermission('user', 'assign'), userPermissionController.removePermission);

// Get all permissions for a specific user
router.get('/user/:userId', authenticateToken, requirePermission('user', 'read'), userPermissionController.getUserPermissions);

// Get all users with their permissions for the current tenant
router.get('/tenant', authenticateToken, requirePermission('user', 'read'), userPermissionController.getTenantUserPermissions);

// Batch update user permissions
router.post('/batch', authenticateToken, requirePermission('user', 'assign'), userPermissionController.batchUpdatePermissions);

// Check if a user has a specific permission
router.get('/check/:userId/:module/:action', authenticateToken, requirePermission('user', 'read'), userPermissionController.checkPermission);

module.exports = router; 