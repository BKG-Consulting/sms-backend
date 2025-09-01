const express = require('express');
const router = express.Router();
const tenantDashboardController = require('../controllers/tenantDashboardController');
const { authenticateToken, restrictTo, requirePermission } = require('../middleware/authMiddleware');
const { enforceTenantIsolation } = require('../middleware/tenantIsolationMiddleware');

/**
 * Tenant Dashboard Routes
 * Provides comprehensive tenant management and analytics capabilities
 */

// =============================================================================
// SUPER ADMIN ROUTES - Global tenant management
// =============================================================================

/**
 * @route   GET /api/tenant-dashboard/overview
 * @desc    Get comprehensive overview of all tenants (SUPER_ADMIN only)
 * @access  Private - SUPER_ADMIN
 * @query   page, limit, search, status, type
 */
router.get('/overview', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  tenantDashboardController.getTenantOverview
);

/**
 * @route   GET /api/tenant-dashboard/analytics/:tenantId
 * @desc    Get detailed analytics for a specific tenant (SUPER_ADMIN only)
 * @access  Private - SUPER_ADMIN
 * @params  tenantId - Tenant ID to analyze
 * @query   timeframe (7d, 30d, 90d, 1y)
 */
router.get('/analytics/:tenantId', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']),
  enforceTenantIsolation([
    { type: 'tenant', paramName: 'tenantId', required: true }
  ]),
  tenantDashboardController.getTenantAnalytics
);

/**
 * @route   GET /api/tenant-dashboard/health/:tenantId
 * @desc    Get tenant health status (SUPER_ADMIN or own tenant SYSTEM_ADMIN)
 * @access  Private - SUPER_ADMIN, SYSTEM_ADMIN
 * @params  tenantId - Tenant ID to check
 */
router.get('/health/:tenantId', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN', 'SYSTEM_ADMIN']),
  tenantDashboardController.getTenantHealth
);

// =============================================================================
// SYSTEM ADMIN ROUTES - Current tenant management
// =============================================================================

/**
 * @route   GET /api/tenant-dashboard/current
 * @desc    Get dashboard for current tenant (SYSTEM_ADMIN)
 * @access  Private - SYSTEM_ADMIN
 */
router.get('/current', 
  authenticateToken, 
  restrictTo(['SYSTEM_ADMIN']), 
  tenantDashboardController.getCurrentTenantDashboard
);

/**
 * @route   GET /api/tenant-dashboard/my-health
 * @desc    Get health status for current tenant (SYSTEM_ADMIN)
 * @access  Private - SYSTEM_ADMIN
 */
router.get('/my-health', 
  authenticateToken, 
  restrictTo(['SYSTEM_ADMIN']), 
  (req, res, next) => {
    // Set tenantId from user context for health check
    req.params.tenantId = req.user.tenantId;
    next();
  },
  tenantDashboardController.getTenantHealth
);

// =============================================================================
// SHARED ROUTES - Both SUPER_ADMIN and SYSTEM_ADMIN
// =============================================================================

/**
 * @route   GET /api/tenant-dashboard/quick-stats
 * @desc    Get quick statistics for dashboard widgets
 * @access  Private - SUPER_ADMIN, SYSTEM_ADMIN
 */
router.get('/quick-stats', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN', 'SYSTEM_ADMIN']), 
  async (req, res, next) => {
    try {
      const isSuperAdmin = req.user.userRoles?.some(r => r.name === 'SUPER_ADMIN');
      
      if (isSuperAdmin) {
        // Super admin gets global stats
        const { prisma } = require('../../prisma/client');
        
        const [
          totalTenants,
          activeTenants,
          totalUsers,
          recentTenants
        ] = await Promise.all([
          prisma.tenant.count(),
          prisma.tenant.count({ where: { status: 'ACTIVE' } }),
          prisma.user.count(),
          prisma.tenant.count({
            where: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
              }
            }
          })
        ]);

        res.json({
          success: true,
          data: {
            role: 'SUPER_ADMIN',
            stats: {
              totalTenants,
              activeTenants,
              totalUsers,
              recentTenants,
              tenantGrowthRate: recentTenants > 0 ? ((recentTenants / totalTenants) * 100).toFixed(1) : '0'
            }
          }
        });
      } else {
        // System admin gets tenant-specific stats
        const tenantId = req.user.tenantId;
        const { prisma } = require('../../prisma/client');
        
        const [
          totalUsers,
          verifiedUsers,
          totalDepartments,
          recentUsers
        ] = await Promise.all([
          prisma.user.count({ where: { tenantId } }),
          prisma.user.count({ where: { tenantId, verified: true } }),
          prisma.department.count({ where: { tenantId } }),
          prisma.user.count({
            where: {
              tenantId,
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
              }
            }
          })
        ]);

        res.json({
          success: true,
          data: {
            role: 'SYSTEM_ADMIN',
            tenantId,
            stats: {
              totalUsers,
              verifiedUsers,
              totalDepartments,
              recentUsers,
              verificationRate: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(1) : '0'
            }
          }
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// TENANT MANAGEMENT ACTIONS
// =============================================================================

/**
 * @route   POST /api/tenant-dashboard/actions/suspend-tenant/:tenantId
 * @desc    Suspend a tenant (SUPER_ADMIN only)
 * @access  Private - SUPER_ADMIN
 */
router.post('/actions/suspend-tenant/:tenantId', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']),
  async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { reason } = req.body;
      const { prisma } = require('../../prisma/client');
      const { logger } = require('../utils/logger');

      const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: { 
          status: 'SUSPENDED',
          // Add suspension reason to a notes field if you have one
        }
      });

      logger.info('Tenant suspended', {
        tenantId,
        suspendedBy: req.user.userId,
        reason
      });

      res.json({
        success: true,
        message: 'Tenant suspended successfully',
        data: { tenant: updatedTenant }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   POST /api/tenant-dashboard/actions/activate-tenant/:tenantId
 * @desc    Activate a tenant (SUPER_ADMIN only)
 * @access  Private - SUPER_ADMIN
 */
router.post('/actions/activate-tenant/:tenantId', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']),
  async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { prisma } = require('../../prisma/client');
      const { logger } = require('../utils/logger');

      const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE' }
      });

      logger.info('Tenant activated', {
        tenantId,
        activatedBy: req.user.userId
      });

      res.json({
        success: true,
        message: 'Tenant activated successfully',
        data: { tenant: updatedTenant }
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/tenant-dashboard/export/:tenantId
 * @desc    Export tenant data (SUPER_ADMIN or own tenant SYSTEM_ADMIN)
 * @access  Private - SUPER_ADMIN, SYSTEM_ADMIN
 */
router.get('/export/:tenantId', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN', 'SYSTEM_ADMIN']),
  async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const userTenantId = req.user.tenantId;
      const isSuperAdmin = req.user.userRoles?.some(r => r.name === 'SUPER_ADMIN');
      
      // Ensure system admin can only export their own tenant
      if (!isSuperAdmin && tenantId !== userTenantId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Can only export your own tenant data'
        });
      }

      const { prisma } = require('../../prisma/client');
      const { logger } = require('../utils/logger');

      // Export tenant data (customize based on your needs)
      const exportData = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          users: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              verified: true,
              createdAt: true
            }
          },
          departments: {
            include: {
              _count: { select: { users: true } }
            }
          },
          roles: {
            include: {
              _count: { 
                select: { 
                  userRoles: true,
                  userDepartmentRoles: true 
                } 
              }
            }
          },
          branding: true
        }
      });

      if (!exportData) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      logger.info('Tenant data exported', {
        tenantId,
        exportedBy: req.user.userId,
        recordCount: {
          users: exportData.users.length,
          departments: exportData.departments.length,
          roles: exportData.roles.length
        }
      });

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=tenant-${tenantId}-export-${new Date().toISOString().split('T')[0]}.json`);
      
      res.json({
        exportInfo: {
          tenantId,
          tenantName: exportData.name,
          exportedAt: new Date().toISOString(),
          exportedBy: req.user.userId
        },
        data: exportData
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
