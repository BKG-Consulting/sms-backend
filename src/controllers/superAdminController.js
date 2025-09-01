const { z } = require('zod');
const { logger } = require('../utils/logger');
const tenantManagementService = require('../services/tenantManagementService');
const tenantService = require('../services/tenantService');
const userService = require('../services/userService');
const { prisma } = require('../../prisma/client');

/**
 * Super Admin Controller
 * Provides global system administration capabilities
 */

// Validation schemas
const bulkUserCreateSchema = z.object({
  tenantId: z.string().uuid(),
  users: z.array(z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    password: z.string().optional(),
    roleIds: z.array(z.string().uuid()).optional()
  })).min(1).max(100) // Limit bulk operations
});

const tenantActionSchema = z.object({
  action: z.enum(['suspend', 'activate', 'delete']),
  reason: z.string().optional(),
  tenantIds: z.array(z.string().uuid()).min(1).max(10)
});

const systemConfigSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  registrationEnabled: z.boolean().optional(),
  maxTenantsPerPlan: z.object({
    free: z.number().int().min(0).optional(),
    basic: z.number().int().min(0).optional(),
    premium: z.number().int().min(0).optional(),
    enterprise: z.number().int().min(0).optional()
  }).optional(),
  defaultTenantLimits: z.object({
    maxUsers: z.number().int().min(1).optional(),
    maxStorageGB: z.number().int().min(1).optional()
  }).optional()
});

const superAdminController = {
  /**
   * Get comprehensive system overview
   */
  getSystemOverview: async (req, res, next) => {
    try {
      const { timeframe = '30d' } = req.query;
      
      const [
        systemStats,
        tenantStats,
        recentActivity,
        systemHealth
      ] = await Promise.all([
        tenantManagementService.getTenantStatistics(timeframe),
        
        // Additional system metrics
        prisma.$queryRaw`
          SELECT 
            COUNT(DISTINCT t.id) as total_tenants,
            COUNT(DISTINCT u.id) as total_users,
            COUNT(DISTINCT d.id) as total_departments,
            COUNT(DISTINCT r.id) as total_roles,
            AVG(user_counts.user_count) as avg_users_per_tenant
          FROM "Tenant" t
          LEFT JOIN "User" u ON t.id = u."tenantId"
          LEFT JOIN "Department" d ON t.id = d."tenantId"
          LEFT JOIN "Role" r ON t.id = r."tenantId"
          LEFT JOIN (
            SELECT "tenantId", COUNT(*) as user_count
            FROM "User"
            GROUP BY "tenantId"
          ) user_counts ON t.id = user_counts."tenantId"
        `,
        
        // Recent activity across all tenants
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            verified: true,
            tenant: {
              select: { name: true, domain: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        }),
        
        // System health indicators
        this.getSystemHealthMetrics()
      ]);

      res.json({
        success: true,
        data: {
          overview: systemStats,
          systemMetrics: systemStats[0],
          recentActivity,
          systemHealth,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error fetching system overview:', error);
      next(error);
    }
  },

  /**
   * Bulk tenant operations
   */
  bulkTenantActions: async (req, res, next) => {
    try {
      const { action, reason, tenantIds } = tenantActionSchema.parse(req.body);
      const executedBy = req.user.userId;
      
      const results = {
        successful: [],
        failed: [],
        summary: {
          total: tenantIds.length,
          successful: 0,
          failed: 0
        }
      };

      for (const tenantId of tenantIds) {
        try {
          let result;
          
          switch (action) {
            case 'suspend':
              result = await prisma.tenant.update({
                where: { id: tenantId },
                data: { status: 'SUSPENDED' },
                select: { id: true, name: true, domain: true }
              });
              break;
              
            case 'activate':
              result = await prisma.tenant.update({
                where: { id: tenantId },
                data: { status: 'ACTIVE' },
                select: { id: true, name: true, domain: true }
              });
              break;
              
            case 'delete':
              // Soft delete - mark as deleted but don't actually remove
              result = await prisma.tenant.update({
                where: { id: tenantId },
                data: { status: 'DELETED' },
                select: { id: true, name: true, domain: true }
              });
              break;
              
            default:
              throw new Error(`Unknown action: ${action}`);
          }

          results.successful.push({
            tenantId,
            tenant: result,
            action
          });
          results.summary.successful++;

          logger.info(`Bulk tenant ${action} successful`, {
            tenantId,
            tenantName: result.name,
            executedBy,
            reason
          });

        } catch (tenantError) {
          logger.error(`Bulk tenant ${action} failed`, {
            tenantId,
            error: tenantError.message,
            executedBy
          });
          
          results.failed.push({
            tenantId,
            error: tenantError.message,
            action
          });
          results.summary.failed++;
        }
      }

      res.json({
        success: true,
        message: `Bulk ${action} operation completed`,
        data: results
      });

    } catch (error) {
      logger.error('Error in bulk tenant actions:', error);
      next(error);
    }
  },

  /**
   * Bulk user creation across tenants
   */
  bulkCreateUsers: async (req, res, next) => {
    try {
      const { tenantId, users } = bulkUserCreateSchema.parse(req.body);
      const createdBy = req.user.userId;

      const result = await tenantManagementService.bulkCreateUsers(
        tenantId, 
        users, 
        createdBy
      );

      logger.info('Bulk user creation initiated by super admin', {
        tenantId,
        userCount: users.length,
        createdBy,
        summary: result.summary
      });

      res.status(201).json({
        success: true,
        message: 'Bulk user creation completed',
        data: result
      });

    } catch (error) {
      logger.error('Error in bulk user creation:', error);
      next(error);
    }
  },

  /**
   * Export system data
   */
  exportSystemData: async (req, res, next) => {
    try {
      const { 
        includeAllTenants = false,
        tenantIds,
        format = 'json',
        includeUsers = true,
        includeDepartments = true,
        includeRoles = true,
        includeBranding = true
      } = req.query;

      const exportData = {
        exportInfo: {
          exportedBy: req.user.userId,
          exportedAt: new Date().toISOString(),
          type: includeAllTenants ? 'full_system' : 'selected_tenants',
          format
        },
        tenants: []
      };

      let targetTenantIds;
      
      if (includeAllTenants === 'true') {
        const allTenants = await prisma.tenant.findMany({
          select: { id: true },
          where: { status: { not: 'DELETED' } }
        });
        targetTenantIds = allTenants.map(t => t.id);
      } else if (tenantIds) {
        targetTenantIds = Array.isArray(tenantIds) ? tenantIds : [tenantIds];
      } else {
        return res.status(400).json({
          success: false,
          message: 'Either includeAllTenants=true or tenantIds must be specified'
        });
      }

      // Export each tenant's data
      for (const tenantId of targetTenantIds) {
        try {
          const tenantData = await tenantManagementService.exportTenantData(tenantId, {
            includeUsers: includeUsers === 'true',
            includeDepartments: includeDepartments === 'true',
            includeRoles: includeRoles === 'true',
            includeBranding: includeBranding === 'true',
            format
          });
          
          exportData.tenants.push(tenantData);
        } catch (tenantError) {
          logger.warn('Failed to export tenant data', {
            tenantId,
            error: tenantError.message
          });
        }
      }

      logger.info('System data export completed', {
        exportedBy: req.user.userId,
        tenantCount: exportData.tenants.length,
        totalRequested: targetTenantIds.length
      });

      // Set headers for file download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `system-export-${timestamp}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      
      res.json(exportData);

    } catch (error) {
      logger.error('Error exporting system data:', error);
      next(error);
    }
  },

  /**
   * Get system health status
   */
  getSystemHealth: async (req, res, next) => {
    try {
      const health = await this.getSystemHealthMetrics();
      
      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      logger.error('Error fetching system health:', error);
      next(error);
    }
  },

  /**
   * System maintenance operations
   */
  performMaintenance: async (req, res, next) => {
    try {
      const { operation, parameters = {} } = req.body;
      const executedBy = req.user.userId;
      
      let result;

      switch (operation) {
        case 'cleanup_sessions':
          result = await this.cleanupExpiredSessions();
          break;
          
        case 'cleanup_tokens':
          result = await this.cleanupExpiredTokens();
          break;
          
        case 'data_integrity_check':
          result = await this.performDataIntegrityCheck();
          break;
          
        case 'tenant_health_scan':
          result = await this.performTenantHealthScan();
          break;
          
        default:
          return res.status(400).json({
            success: false,
            message: `Unknown maintenance operation: ${operation}`
          });
      }

      logger.info('System maintenance operation completed', {
        operation,
        executedBy,
        result: result.summary
      });

      res.json({
        success: true,
        message: `Maintenance operation '${operation}' completed successfully`,
        data: result
      });

    } catch (error) {
      logger.error('Error performing system maintenance:', error);
      next(error);
    }
  },

  /**
   * Get advanced analytics
   */
  getAdvancedAnalytics: async (req, res, next) => {
    try {
      const { 
        timeframe = '30d',
        metrics = 'all',
        groupBy = 'day'
      } = req.query;

      const [
        tenantGrowthAnalytics,
        userEngagementAnalytics,
        resourceUtilizationAnalytics,
        performanceAnalytics
      ] = await Promise.all([
        this.getTenantGrowthAnalytics(timeframe, groupBy),
        this.getUserEngagementAnalytics(timeframe),
        this.getResourceUtilizationAnalytics(),
        this.getPerformanceAnalytics()
      ]);

      const analytics = {
        timeframe,
        groupBy,
        generatedAt: new Date().toISOString()
      };

      if (metrics === 'all' || metrics.includes('growth')) {
        analytics.tenantGrowth = tenantGrowthAnalytics;
      }
      
      if (metrics === 'all' || metrics.includes('engagement')) {
        analytics.userEngagement = userEngagementAnalytics;
      }
      
      if (metrics === 'all' || metrics.includes('resources')) {
        analytics.resourceUtilization = resourceUtilizationAnalytics;
      }
      
      if (metrics === 'all' || metrics.includes('performance')) {
        analytics.performance = performanceAnalytics;
      }

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Error fetching advanced analytics:', error);
      next(error);
    }
  },

  // Helper methods

  async getSystemHealthMetrics() {
    try {
      const [
        databaseHealth,
        tenantHealth,
        userHealth,
        performanceHealth
      ] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkTenantHealth(),
        this.checkUserHealth(),
        this.checkPerformanceHealth()
      ]);

      const overallScore = (
        databaseHealth.score + 
        tenantHealth.score + 
        userHealth.score + 
        performanceHealth.score
      ) / 4;

      return {
        overall: {
          score: Math.round(overallScore),
          status: overallScore >= 80 ? 'healthy' : overallScore >= 60 ? 'warning' : 'critical'
        },
        components: {
          database: databaseHealth,
          tenants: tenantHealth,
          users: userHealth,
          performance: performanceHealth
        },
        checkedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error checking system health:', error);
      return {
        overall: { score: 0, status: 'error' },
        error: error.message
      };
    }
  },

  async checkDatabaseHealth() {
    try {
      const startTime = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        score: responseTime < 100 ? 100 : responseTime < 500 ? 80 : 50,
        status: responseTime < 500 ? 'healthy' : 'warning',
        metrics: { responseTime }
      };
    } catch (error) {
      return { score: 0, status: 'critical', error: error.message };
    }
  },

  async checkTenantHealth() {
    try {
      const [total, active, suspended] = await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { status: 'ACTIVE' } }),
        prisma.tenant.count({ where: { status: 'SUSPENDED' } })
      ]);

      const healthRatio = total > 0 ? (active / total) * 100 : 100;

      return {
        score: Math.round(healthRatio),
        status: healthRatio >= 90 ? 'healthy' : healthRatio >= 70 ? 'warning' : 'critical',
        metrics: { total, active, suspended, healthRatio }
      };
    } catch (error) {
      return { score: 0, status: 'critical', error: error.message };
    }
  },

  async checkUserHealth() {
    try {
      const [total, verified, recent] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { verified: true } }),
        prisma.user.count({
          where: {
            updatedAt: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      const verificationRatio = total > 0 ? (verified / total) * 100 : 100;
      const activityRatio = total > 0 ? (recent / total) * 100 : 0;

      const score = (verificationRatio + activityRatio) / 2;

      return {
        score: Math.round(score),
        status: score >= 70 ? 'healthy' : score >= 50 ? 'warning' : 'critical',
        metrics: { total, verified, recent, verificationRatio, activityRatio }
      };
    } catch (error) {
      return { score: 0, status: 'critical', error: error.message };
    }
  },

  async checkPerformanceHealth() {
    // This is a placeholder - implement actual performance monitoring
    return {
      score: 85,
      status: 'healthy',
      metrics: {
        avgResponseTime: 150,
        errorRate: 0.01,
        throughput: 100
      }
    };
  },

  async cleanupExpiredSessions() {
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    const deleted = await prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { updatedAt: { lt: cutoffDate } }
        ]
      }
    });

    return {
      operation: 'cleanup_sessions',
      summary: { deletedSessions: deleted.count },
      completedAt: new Date().toISOString()
    };
  },

  async cleanupExpiredTokens() {
    const deleted = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    });

    return {
      operation: 'cleanup_tokens',
      summary: { deletedTokens: deleted.count },
      completedAt: new Date().toISOString()
    };
  },

  async performDataIntegrityCheck() {
    // Check for orphaned records and data inconsistencies
    const [
      orphanedUsers,
      unusedRoles,
      orphanedDepartments
    ] = await Promise.all([
      prisma.user.count({
        where: {
          userRoles: { none: {} },
          userDepartmentRoles: { none: {} }
        }
      }),
      prisma.role.count({
        where: {
          userRoles: { none: {} },
          userDepartmentRoles: { none: {} },
          name: { notIn: ['SYSTEM_ADMIN', 'SUPER_ADMIN'] }
        }
      }),
      prisma.department.count({
        where: { users: { none: {} } }
      })
    ]);

    return {
      operation: 'data_integrity_check',
      summary: {
        orphanedUsers,
        unusedRoles,
        orphanedDepartments,
        issuesFound: orphanedUsers + orphanedDepartments
      },
      completedAt: new Date().toISOString()
    };
  },

  async performTenantHealthScan() {
    const tenants = await prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true }
    });

    const results = {
      healthy: 0,
      warning: 0,
      critical: 0,
      details: []
    };

    for (const tenant of tenants) {
      try {
        const health = await tenantManagementService.monitorTenantHealth(tenant.id);
        
        if (health.overallHealth.score >= 80) results.healthy++;
        else if (health.overallHealth.score >= 60) results.warning++;
        else results.critical++;

        results.details.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          healthScore: health.overallHealth.score,
          status: health.overallHealth.status
        });
        
      } catch (error) {
        results.critical++;
        results.details.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          error: error.message
        });
      }
    }

    return {
      operation: 'tenant_health_scan',
      summary: {
        totalTenants: tenants.length,
        healthy: results.healthy,
        warning: results.warning,
        critical: results.critical
      },
      details: results.details,
      completedAt: new Date().toISOString()
    };
  },

  async getTenantGrowthAnalytics(timeframe, groupBy) {
    // Implementation for tenant growth analytics
    return { message: 'Tenant growth analytics - implement based on requirements' };
  },

  async getUserEngagementAnalytics(timeframe) {
    // Implementation for user engagement analytics
    return { message: 'User engagement analytics - implement based on requirements' };
  },

  async getResourceUtilizationAnalytics() {
    // Implementation for resource utilization analytics
    return { message: 'Resource utilization analytics - implement based on requirements' };
  },

  async getPerformanceAnalytics() {
    // Implementation for performance analytics
    return { message: 'Performance analytics - implement based on requirements' };
  }
};

module.exports = superAdminController;
