const express = require('express');
const router = express.Router();
const rolePermissionController = require('../controllers/rolePermissionController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

// Get all roles for the tenant
router.get('/roles', 
  authenticateToken, 
  requirePermission('role', 'read'),
  rolePermissionController.getRoles
);

// Get all permissions (optionally filtered by module)
router.get('/permissions', 
  authenticateToken, 
  requirePermission('permission', 'read'),
  rolePermissionController.getPermissions
);

// Get role permissions matrix
router.get('/role-permissions', 
  authenticateToken, 
  requirePermission('role', 'read'),
  rolePermissionController.getRolePermissions
);

// Update a single role permission
router.put('/role-permissions/:roleId/:permissionId', 
  authenticateToken, 
  requirePermission('role', 'update'),
  rolePermissionController.updateRolePermission
);

// Batch update role permissions
router.put('/role-permissions/batch', 
  authenticateToken, 
  requirePermission('role', 'update'),
  rolePermissionController.batchUpdateRolePermissions
);

// Get permissions for a specific module (e.g., auditProgram)
router.get('/permissions/module/:module', 
  authenticateToken, 
  requirePermission('permission', 'read'),
  rolePermissionController.getPermissionsByModule
);

// Get role permissions for a specific module
router.get('/role-permissions/module/:module', 
  authenticateToken, 
  requirePermission('role', 'read'),
  rolePermissionController.getRolePermissionsByModule
);

// Get permissions for roles (used by frontend to get user permissions)
router.post('/permissions-for-roles', 
  authenticateToken, 
  rolePermissionController.getPermissionsForRoles
);

module.exports = router; 