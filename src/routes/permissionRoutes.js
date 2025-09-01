const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

// Get all permissions
router.get('/', authenticateToken, requirePermission('permission:read'), permissionController.getPermissions);

// Get permission categories (must come before /:id)
router.get('/categories/list', authenticateToken, requirePermission('permission:read'), permissionController.getPermissionCategories);

// Get permissions by module (must come before /:id)
router.get('/module/:module', authenticateToken, requirePermission('permission:read'), permissionController.getPermissionsByModule);

// Check specific permission (new endpoint)
router.post('/check', authenticateToken, permissionController.checkPermission);

// Get permission by ID (must come after specific routes)
router.get('/:id', authenticateToken, requirePermission('permission:read'), permissionController.getPermissionById);

// Create new permission
router.post('/', authenticateToken, requirePermission('permission:manage'), permissionController.createPermission);

// Update permission
router.put('/:id', authenticateToken, requirePermission('permission:manage'), permissionController.updatePermission);

// Delete permission
router.delete('/:id', authenticateToken, requirePermission('permission:manage'), permissionController.deletePermission);

module.exports = router; 