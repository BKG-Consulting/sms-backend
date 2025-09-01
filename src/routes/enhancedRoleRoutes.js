/**
 * ENHANCED ROLE ROUTES WITH SUPER ADMIN CAPABILITIES
 * Provides both tenant-scoped and global role management endpoints
 */

const express = require('express');
const router = express.Router();
const roleController = require('../controllers/enhancedRoleController');
const { authenticateJWT, requireSuperAdmin, requireTenantAccess } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { body, param } = require('express-validator');

// ==========================================
// TENANT-SCOPED ROLE MANAGEMENT
// ==========================================

/**
 * GET /api/roles/tenant/:tenantId/roles
 * Get all roles for a specific tenant
 */
router.get('/tenant/:tenantId/roles', 
  authenticateJWT,
  requireTenantAccess,
  [
    param('tenantId').notEmpty().withMessage('Tenant ID is required')
  ],
  validateRequest,
  roleController.getAllRoles
);

/**
 * GET /api/roles/tenant/:tenantId/available
 * Get roles that the current user can assign to others
 */
router.get('/tenant/:tenantId/available',
  authenticateJWT,
  requireTenantAccess,
  [
    param('tenantId').notEmpty().withMessage('Tenant ID is required')
  ],
  validateRequest,
  roleController.getAvailableRoles
);

/**
 * POST /api/roles/tenant/:tenantId/create
 * Create a new role in a tenant
 */
router.post('/tenant/:tenantId/create',
  authenticateJWT,
  requireTenantAccess,
  [
    param('tenantId').notEmpty().withMessage('Tenant ID is required'),
    body('name').notEmpty().withMessage('Role name is required'),
    body('description').optional().isString(),
    body('permissions').optional().isArray()
  ],
  validateRequest,
  roleController.createRole
);

/**
 * PUT /api/roles/:id
 * Update an existing role
 */
router.put('/:id',
  authenticateJWT,
  [
    param('id').notEmpty().withMessage('Role ID is required'),
    body('name').optional().notEmpty().withMessage('Role name cannot be empty'),
    body('description').optional().isString(),
    body('permissions').optional().isArray()
  ],
  validateRequest,
  roleController.updateRole
);

/**
 * DELETE /api/roles/:id
 * Delete a role (if removable)
 */
router.delete('/:id',
  authenticateJWT,
  [
    param('id').notEmpty().withMessage('Role ID is required')
  ],
  validateRequest,
  roleController.deleteRole
);

// ==========================================
// SUPER ADMIN GLOBAL MANAGEMENT
// ==========================================

/**
 * POST /api/roles/super-admin/create
 * Create super admin user (System initialization or existing super admin)
 */
router.post('/super-admin/create',
  authenticateJWT, // Optional for system initialization
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  ],
  validateRequest,
  roleController.createSuperAdmin
);

/**
 * GET /api/roles/super-admin/global-analysis
 * Get global role analysis across all tenants
 */
router.get('/super-admin/global-analysis',
  authenticateJWT,
  requireSuperAdmin,
  roleController.getGlobalRoleAnalysis
);

/**
 * GET /api/roles/super-admin/health-check
 * Perform comprehensive system health check
 */
router.get('/super-admin/health-check',
  authenticateJWT,
  requireSuperAdmin,
  roleController.performSystemHealthCheck
);

/**
 * GET /api/roles/super-admin/tenants
 * Get all tenants with analytics
 */
router.get('/super-admin/tenants',
  authenticateJWT,
  requireSuperAdmin,
  roleController.getAllTenantsWithAnalytics
);

/**
 * POST /api/roles/super-admin/move-user
 * Move user between tenants
 */
router.post('/super-admin/move-user',
  authenticateJWT,
  requireSuperAdmin,
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('fromTenantId').notEmpty().withMessage('Source tenant ID is required'),
    body('toTenantId').notEmpty().withMessage('Destination tenant ID is required')
  ],
  validateRequest,
  roleController.moveUserBetweenTenants
);

// ==========================================
// MIDDLEWARE DEFINITIONS
// ==========================================

/**
 * Require Super Admin Access
 */
async function requireSuperAdmin(req, res, next) {
  try {
    const superAdminService = require('../services/superAdminService');
    await superAdminService.verifySuperAdminAccess(req.user.id);
    next();
  } catch (error) {
    res.status(403).json({ 
      error: 'Super Admin access required',
      details: error.message 
    });
  }
}

/**
 * Require Tenant Access
 */
async function requireTenantAccess(req, res, next) {
  try {
    const { tenantId } = req.params;
    const superAdminService = require('../services/superAdminService');
    
    // Super admin has access to all tenants
    if (await superAdminService.verifySuperAdminAccess(req.user.id).catch(() => false)) {
      return next();
    }
    
    // Regular users must be in the same tenant
    if (req.user.tenantId !== tenantId) {
      return res.status(403).json({ 
        error: 'Access denied to tenant resources' 
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ 
      error: 'Error validating tenant access',
      details: error.message 
    });
  }
}

module.exports = router;
