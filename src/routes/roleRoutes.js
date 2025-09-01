const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const permissionController = require('../controllers/permissionController');
const rolePermissionController = require('../controllers/rolePermissionController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Permission management (must come before /:id routes to avoid conflicts)
router.get('/permissions', authenticateToken, permissionController.getPermissions);
router.get('/role-permissions', authenticateToken, rolePermissionController.getRolePermissions);
router.post('/role-permissions', authenticateToken, rolePermissionController.updateRolePermission);
router.post('/role-permissions/batch', authenticateToken, rolePermissionController.batchUpdateRolePermissions);
router.post('/role-permissions/user-permissions', authenticateToken, rolePermissionController.getPermissionsForRoles);

// Role-specific permission management (must come before /:id routes to avoid conflicts)
router.get('/:roleId/permissions', authenticateToken, rolePermissionController.getRolePermissionsForRole);
router.put('/:roleId/permissions', authenticateToken, rolePermissionController.updateRolePermissionsForRole);
router.post('/:roleId/permissions/assign', authenticateToken, rolePermissionController.assignPermissionsToRole);
router.delete('/:roleId/permissions/remove', authenticateToken, rolePermissionController.removePermissionsFromRole);

// Basic role CRUD operations (must come after specific routes to avoid conflicts)
router.post('/', authenticateToken, roleController.createRole);
router.get('/', authenticateToken, roleController.getRoles);
router.get('/:id', authenticateToken, roleController.getRole);
router.put('/:id', authenticateToken, roleController.updateRole);
router.delete('/:id', authenticateToken, roleController.deleteRole);

module.exports = router;