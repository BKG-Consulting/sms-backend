const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { authenticateToken, restrictTo } = require('../middleware/authMiddleware');

/**
 * Super Admin Routes
 * Global system administration and management
 * All routes require SUPER_ADMIN role
 */

// =============================================================================
// SYSTEM OVERVIEW AND ANALYTICS
// =============================================================================

/**
 * @route   GET /api/super-admin/overview
 * @desc    Get comprehensive system overview with statistics
 * @access  Private - SUPER_ADMIN only
 * @query   timeframe (7d, 30d, 90d, 1y)
 */
router.get('/overview', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  superAdminController.getSystemOverview
);

/**
 * @route   GET /api/super-admin/health
 * @desc    Get system health status and metrics
 * @access  Private - SUPER_ADMIN only
 */
router.get('/health', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  superAdminController.getSystemHealth
);

/**
 * @route   GET /api/super-admin/analytics
 * @desc    Get advanced system analytics
 * @access  Private - SUPER_ADMIN only
 * @query   timeframe, metrics, groupBy
 */
router.get('/analytics', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  superAdminController.getAdvancedAnalytics
);

// =============================================================================
// TENANT MANAGEMENT
// =============================================================================

/**
 * @route   POST /api/super-admin/tenants/bulk-actions
 * @desc    Perform bulk actions on multiple tenants
 * @access  Private - SUPER_ADMIN only
 * @body    { action: 'suspend|activate|delete', tenantIds: [...], reason?: string }
 */
router.post('/tenants/bulk-actions', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  superAdminController.bulkTenantActions
);

/**
 * @route   POST /api/super-admin/users/bulk-create
 * @desc    Bulk create users for a specific tenant
 * @access  Private - SUPER_ADMIN only
 * @body    { tenantId: string, users: [{ email, firstName, lastName, password?, roleIds? }] }
 */
router.post('/users/bulk-create', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  superAdminController.bulkCreateUsers
);

// =============================================================================
// DATA EXPORT AND BACKUP
// =============================================================================

/**
 * @route   GET /api/super-admin/export/system
 * @desc    Export system data for backup or migration
 * @access  Private - SUPER_ADMIN only
 * @query   includeAllTenants, tenantIds, format, includeUsers, includeDepartments, includeRoles, includeBranding
 */
router.get('/export/system', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  superAdminController.exportSystemData
);

// =============================================================================
// MAINTENANCE OPERATIONS
// =============================================================================

/**
 * @route   POST /api/super-admin/maintenance
 * @desc    Perform system maintenance operations
 * @access  Private - SUPER_ADMIN only
 * @body    { operation: string, parameters?: object }
 */
router.post('/maintenance', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  superAdminController.performMaintenance
);

/**
 * @route   POST /api/super-admin/maintenance/database-cleanup
 * @desc    Clean up expired sessions, tokens, and orphaned records
 * @access  Private - SUPER_ADMIN only
 */
router.post('/maintenance/database-cleanup', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  async (req, res, next) => {
    try {
      // Perform multiple cleanup operations
      const operations = [
        { operation: 'cleanup_sessions' },
        { operation: 'cleanup_tokens' },
        { operation: 'data_integrity_check' }
      ];

      const results = [];
      for (const op of operations) {
        req.body = op;
        try {
          const result = await superAdminController.performMaintenance(req, res, () => {});
          results.push(result);
        } catch (error) {
          results.push({ operation: op.operation, error: error.message });
        }
      }

      res.json({
        success: true,
        message: 'Database cleanup completed',
        data: { operations: results }
      });

    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// SYSTEM CONFIGURATION
// =============================================================================

/**
 * @route   GET /api/super-admin/config
 * @desc    Get system configuration
 * @access  Private - SUPER_ADMIN only
 */
router.get('/config', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  async (req, res, next) => {
    try {
      // Return current system configuration
      // This could be stored in database or environment variables
      const config = {
        maintenance: {
          enabled: process.env.MAINTENANCE_MODE === 'true',
          message: process.env.MAINTENANCE_MESSAGE || 'System under maintenance'
        },
        registration: {
          enabled: process.env.REGISTRATION_ENABLED !== 'false',
          requireApproval: process.env.REQUIRE_REGISTRATION_APPROVAL === 'true'
        },
        limits: {
          maxTenantsPerPlan: {
            free: parseInt(process.env.MAX_TENANTS_FREE) || 100,
            basic: parseInt(process.env.MAX_TENANTS_BASIC) || 500,
            premium: parseInt(process.env.MAX_TENANTS_PREMIUM) || 1000,
            enterprise: parseInt(process.env.MAX_TENANTS_ENTERPRISE) || -1 // unlimited
          },
          defaultTenantLimits: {
            maxUsers: parseInt(process.env.DEFAULT_MAX_USERS) || 50,
            maxStorageGB: parseInt(process.env.DEFAULT_MAX_STORAGE_GB) || 5
          }
        },
        security: {
          sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 3600,
          maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
          lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 900
        }
      };

      res.json({
        success: true,
        data: config
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   PUT /api/super-admin/config
 * @desc    Update system configuration
 * @access  Private - SUPER_ADMIN only
 */
router.put('/config', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  async (req, res, next) => {
    try {
      const { logger } = require('../utils/logger');
      const updates = req.body;
      const updatedBy = req.user.userId;

      // In a real implementation, you'd update configuration in database
      // For now, just log the configuration changes
      logger.info('System configuration updated', {
        updates,
        updatedBy,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'System configuration updated successfully',
        data: { updatedBy, updatedAt: new Date().toISOString() }
      });

    } catch (error) {
      next(error);
    }
  }
);

// =============================================================================
// MONITORING AND ALERTS
// =============================================================================

/**
 * @route   GET /api/super-admin/alerts
 * @desc    Get system alerts and notifications
 * @access  Private - SUPER_ADMIN only
 */
router.get('/alerts', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  async (req, res, next) => {
    try {
      const { prisma } = require('../../prisma/client');
      const { timeframe = '24h' } = req.query;

      let startDate;
      switch (timeframe) {
        case '1h': startDate = new Date(Date.now() - 60 * 60 * 1000); break;
        case '24h': startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); break;
        case '7d': startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); break;
        default: startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }

      // Generate alerts based on system conditions
      const alerts = [];

      // Check for suspended tenants
      const suspendedTenants = await prisma.tenant.count({
        where: { status: 'SUSPENDED' }
      });

      if (suspendedTenants > 0) {
        alerts.push({
          id: 'suspended-tenants',
          type: 'warning',
          title: 'Suspended Tenants',
          message: `${suspendedTenants} tenant(s) are currently suspended`,
          count: suspendedTenants,
          timestamp: new Date().toISOString()
        });
      }

      // Check for recent failed logins
      const recentFailures = await prisma.loginAttempt.count({
        where: {
          success: false,
          attemptedAt: { gte: startDate }
        }
      });

      if (recentFailures > 50) {
        alerts.push({
          id: 'login-failures',
          type: 'error',
          title: 'High Login Failure Rate',
          message: `${recentFailures} failed login attempts in the last ${timeframe}`,
          count: recentFailures,
          timestamp: new Date().toISOString()
        });
      }

      // Check for unverified users
      const unverifiedUsers = await prisma.user.count({
        where: { 
          verified: false,
          createdAt: { 
            lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // older than 24 hours
          }
        }
      });

      if (unverifiedUsers > 10) {
        alerts.push({
          id: 'unverified-users',
          type: 'info',
          title: 'Unverified Users',
          message: `${unverifiedUsers} users have not verified their email after 24+ hours`,
          count: unverifiedUsers,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: true,
        data: {
          alerts,
          summary: {
            total: alerts.length,
            byType: alerts.reduce((acc, alert) => {
              acc[alert.type] = (acc[alert.type] || 0) + 1;
              return acc;
            }, {})
          },
          timeframe,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/super-admin/logs
 * @desc    Get system logs (implement based on your logging system)
 * @access  Private - SUPER_ADMIN only
 */
router.get('/logs', 
  authenticateToken, 
  restrictTo(['SUPER_ADMIN']), 
  async (req, res, next) => {
    try {
      const { 
        level = 'all', 
        limit = 100, 
        offset = 0,
        timeframe = '24h'
      } = req.query;

      // This is a placeholder - implement based on your logging system
      // You might read from log files, database, or external logging service
      
      const logs = [
        {
          id: '1',
          timestamp: new Date().toISOString(),
          level: 'info',
          message: 'User logged in successfully',
          userId: 'user-123',
          tenantId: 'tenant-456'
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          level: 'error',
          message: 'Database connection failed',
          error: 'Connection timeout'
        }
        // Add more log entries...
      ];

      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: logs.length
          },
          filters: { level, timeframe }
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
