const { z } = require('zod');
const { logger } = require('../utils/logger');
const tenantService = require('../services/tenantService');
const userService = require('../services/userService');
const { prisma } = require('../../prisma/client');

/**
 * Enhanced Tenant Dashboard Controller
 * Provides comprehensive tenant management capabilities for both SUPER_ADMIN and SYSTEM_ADMIN
 */

const tenantDashboardController = {
  /**
   * Get comprehensive tenant overview (SUPER_ADMIN)
   */
  getTenantOverview: async (req, res, next) => {
    try {
      const { page = 1, limit = 10, search, status, type } = req.query;
      const offset = (page - 1) * limit;

      // Build filter conditions
      const whereClause = {};
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { domain: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { legalName: { contains: search, mode: 'insensitive' } }
        ];
      }
      if (status) whereClause.status = status;
      if (type) whereClause.type = type;

      const [tenants, totalCount, globalStats] = await Promise.all([
        // Tenant list with comprehensive stats
        prisma.tenant.findMany({
          where: whereClause,
          skip: offset,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            branding: {
              select: {
                primaryColor: true,
                secondaryColor: true,
                logoUrl: true,
                faviconUrl: true,
                isActive: true
              }
            },
            _count: {
              select: {
                users: true,
                departments: true,
                campuses: true,
                roles: true,
                auditPrograms: true
              }
            },
            users: {
              where: { verified: true },
              select: { id: true, createdAt: true }
            }
          }
        }),

        // Total count for pagination
        prisma.tenant.count({ where: whereClause }),

        // Global statistics
        prisma.tenant.aggregate({
          _count: { id: true },
          _avg: { maxUsers: true, maxStorageGB: true }
        })
      ]);

      // Calculate additional metrics for each tenant
      const enrichedTenants = tenants.map(tenant => {
        const activeUsers = tenant.users.length;
        const userGrowthLast30Days = tenant.users.filter(user => 
          new Date(user.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length;

        return {
          id: tenant.id,
          name: tenant.name,
          domain: tenant.domain,
          email: tenant.email,
          type: tenant.type,
          status: tenant.status,
          subscriptionPlan: tenant.subscriptionPlan,
          subscriptionStatus: tenant.subscriptionStatus,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
          
          // Resource limits
          maxUsers: tenant.maxUsers,
          maxStorageGB: tenant.maxStorageGB,
          
          // Branding info
          branding: tenant.branding,
          
          // Usage statistics
          stats: {
            totalUsers: tenant._count.users,
            activeUsers,
            departments: tenant._count.departments,
            campuses: tenant._count.campuses,
            roles: tenant._count.roles,
            auditPrograms: tenant._count.auditPrograms,
            userGrowthLast30Days,
            userUtilization: tenant.maxUsers ? (activeUsers / tenant.maxUsers * 100).toFixed(1) : null
          },
          
          // Health indicators
          health: {
            userActivityLevel: activeUsers > 0 ? 'active' : 'inactive',
            configurationComplete: !!(tenant.name && tenant.domain && tenant.branding?.isActive),
            subscriptionActive: tenant.subscriptionStatus === 'ACTIVE'
          }
        };
      });

      res.json({
        success: true,
        data: {
          tenants: enrichedTenants,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalCount,
            totalPages: Math.ceil(totalCount / limit)
          },
          globalStats: {
            totalTenants: globalStats._count.id,
            avgMaxUsers: Math.round(globalStats._avg.maxUsers || 0),
            avgStorageLimit: Math.round(globalStats._avg.maxStorageGB || 0)
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching tenant overview:', error);
      next(error);
    }
  },

  /**
   * Get detailed tenant analytics (SUPER_ADMIN)
   */
  getTenantAnalytics: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { timeframe = '30d' } = req.query;

      // Calculate date ranges
      const now = new Date();
      let startDate;
      switch (timeframe) {
        case '7d': startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
        case '90d': startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break;
        case '1y': startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); break;
        default: startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const [
        tenant,
        userMetrics,
        departmentMetrics,
        activityMetrics,
        storageMetrics
      ] = await Promise.all([
        // Basic tenant info
        prisma.tenant.findUnique({
          where: { id: tenantId },
          include: {
            branding: true,
            _count: {
              select: {
                users: true,
                departments: true,
                campuses: true,
                roles: true
              }
            }
          }
        }),

        // User growth and activity metrics
        prisma.user.groupBy({
          by: ['createdAt'],
          where: {
            tenantId,
            createdAt: { gte: startDate }
          },
          _count: { id: true },
          orderBy: { createdAt: 'asc' }
        }),

        // Department utilization
        prisma.department.findMany({
          where: { tenantId },
          include: {
            _count: {
              select: {
                users: true
              }
            },
            hod: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }),

        // Recent activity (placeholder - customize based on your audit/activity tracking)
        prisma.user.findMany({
          where: {
            tenantId,
            updatedAt: { gte: startDate }
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            updatedAt: true,
            verified: true
          },
          orderBy: { updatedAt: 'desc' },
          take: 20
        }),

        // Storage utilization (placeholder - implement based on your document storage)
        prisma.document.aggregate({
          where: { tenantId },
          _count: { id: true },
          _sum: { fileSizeBytes: true }
        }).catch(() => ({ _count: { id: 0 }, _sum: { fileSizeBytes: 0 } }))
      ]);

      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Process user growth data
      const userGrowthData = userMetrics.reduce((acc, metric) => {
        const date = metric.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + metric._count.id;
        return acc;
      }, {});

      // Process department data
      const departmentData = departmentMetrics.map(dept => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        userCount: dept._count.users,
        hod: dept.hod ? {
          name: `${dept.hod.firstName} ${dept.hod.lastName}`,
          email: dept.hod.email
        } : null,
        utilization: tenant.maxUsers ? (dept._count.users / tenant.maxUsers * 100).toFixed(1) : null
      }));

      res.json({
        success: true,
        data: {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            domain: tenant.domain,
            status: tenant.status,
            type: tenant.type,
            subscriptionPlan: tenant.subscriptionPlan,
            maxUsers: tenant.maxUsers,
            maxStorageGB: tenant.maxStorageGB,
            branding: tenant.branding
          },
          
          metrics: {
            users: {
              total: tenant._count.users,
              verified: activityMetrics.filter(u => u.verified).length,
              growthData: userGrowthData,
              recentActivity: activityMetrics.slice(0, 10)
            },
            
            departments: {
              total: tenant._count.departments,
              data: departmentData,
              avgUsersPerDept: departmentData.length > 0 
                ? (departmentData.reduce((sum, d) => sum + d.userCount, 0) / departmentData.length).toFixed(1)
                : 0
            },
            
            resources: {
              campuses: tenant._count.campuses,
              roles: tenant._count.roles,
              documents: storageMetrics._count.id,
              storageUsed: storageMetrics._sum.fileSizeBytes || 0,
              storageUtilization: tenant.maxStorageGB 
                ? ((storageMetrics._sum.fileSizeBytes || 0) / (tenant.maxStorageGB * 1024 * 1024 * 1024) * 100).toFixed(1)
                : null
            }
          },
          
          timeframe,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error fetching tenant analytics:', error);
      next(error);
    }
  },

  /**
   * Get current tenant dashboard (SYSTEM_ADMIN)
   */
  getCurrentTenantDashboard: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context not found'
        });
      }

      const [
        tenant,
        userStats,
        departmentStats,
        recentUsers,
        roleDistribution
      ] = await Promise.all([
        // Tenant information
        prisma.tenant.findUnique({
          where: { id: tenantId },
          include: {
            branding: true,
            campuses: {
              select: {
                id: true,
                name: true,
                isMain: true,
                address: true,
                city: true
              }
            }
          }
        }),

        // User statistics
        prisma.user.aggregate({
          where: { tenantId },
          _count: { id: true }
        }),

        // Department overview
        prisma.department.findMany({
          where: { tenantId },
          include: {
            _count: {
              select: { users: true }
            },
            hod: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: { name: 'asc' }
        }),

        // Recent user registrations
        prisma.user.findMany({
          where: { tenantId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            verified: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),

        // Role distribution
        prisma.role.findMany({
          where: { tenantId },
          include: {
            _count: {
              select: {
                userRoles: true,
                userDepartmentRoles: true
              }
            }
          }
        })
      ]);

      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Calculate role usage
      const roleUsage = roleDistribution.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        totalUsers: role._count.userRoles + role._count.userDepartmentRoles,
        systemUsers: role._count.userRoles,
        departmentUsers: role._count.userDepartmentRoles
      }));

      // Department summary
      const departmentSummary = departmentStats.map(dept => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        userCount: dept._count.users,
        hod: dept.hod ? `${dept.hod.firstName} ${dept.hod.lastName}` : 'Not assigned',
        hodEmail: dept.hod?.email
      }));

      res.json({
        success: true,
        data: {
          tenant: {
            id: tenant.id,
            name: tenant.name,
            domain: tenant.domain,
            type: tenant.type,
            status: tenant.status,
            email: tenant.email,
            phone: tenant.phone,
            address: tenant.address,
            city: tenant.city,
            county: tenant.county,
            country: tenant.country,
            subscriptionPlan: tenant.subscriptionPlan,
            maxUsers: tenant.maxUsers,
            maxStorageGB: tenant.maxStorageGB,
            branding: tenant.branding,
            campuses: tenant.campuses
          },

          overview: {
            totalUsers: userStats._count.id,
            verifiedUsers: recentUsers.filter(u => u.verified).length,
            totalDepartments: departmentStats.length,
            totalCampuses: tenant.campuses.length,
            userCapacityUsed: tenant.maxUsers 
              ? Math.round((userStats._count.id / tenant.maxUsers) * 100)
              : null
          },

          departments: departmentSummary,
          recentUsers: recentUsers.map(user => ({
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            verified: user.verified,
            joinedAt: user.createdAt
          })),
          
          roleDistribution: roleUsage,
          
          quickActions: [
            { action: 'createUser', label: 'Add New User', icon: 'user-plus' },
            { action: 'createDepartment', label: 'Create Department', icon: 'building' },
            { action: 'manageBranding', label: 'Update Branding', icon: 'palette' },
            { action: 'viewReports', label: 'View Reports', icon: 'chart-bar' },
            { action: 'manageRoles', label: 'Manage Roles', icon: 'shield' }
          ]
        }
      });

    } catch (error) {
      logger.error('Error fetching current tenant dashboard:', error);
      next(error);
    }
  },

  /**
   * Get tenant health status
   */
  getTenantHealth: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const userTenantId = req.user.tenantId;

      // Super admin can check any tenant, system admin can only check their own
      const targetTenantId = req.user.userRoles?.some(r => r.name === 'SUPER_ADMIN') 
        ? tenantId 
        : userTenantId;

      if (!targetTenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant not specified or accessible'
        });
      }

      const [
        tenant,
        userMetrics,
        configurationStatus,
        lastActivity
      ] = await Promise.all([
        prisma.tenant.findUnique({
          where: { id: targetTenantId },
          include: { branding: true }
        }),

        prisma.user.aggregate({
          where: { 
            tenantId: targetTenantId,
            verified: true
          },
          _count: { id: true }
        }),

        prisma.department.count({
          where: { tenantId: targetTenantId }
        }),

        prisma.user.findFirst({
          where: { tenantId: targetTenantId },
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true }
        })
      ]);

      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Health calculations
      const healthChecks = {
        basicConfiguration: {
          status: !!(tenant.name && tenant.domain && tenant.email),
          score: 25,
          message: 'Basic tenant information complete'
        },
        brandingSetup: {
          status: !!(tenant.branding && tenant.branding.isActive),
          score: 15,
          message: 'Branding configuration active'
        },
        userActivity: {
          status: userMetrics._count.id > 0,
          score: 30,
          message: `${userMetrics._count.id} verified users`
        },
        departmentStructure: {
          status: configurationStatus > 0,
          score: 20,
          message: `${configurationStatus} departments configured`
        },
        recentActivity: {
          status: lastActivity && new Date(lastActivity.updatedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          score: 10,
          message: lastActivity ? 'Recent user activity detected' : 'No recent activity'
        }
      };

      const totalScore = Object.values(healthChecks)
        .filter(check => check.status)
        .reduce((sum, check) => sum + check.score, 0);

      let healthLevel;
      if (totalScore >= 85) healthLevel = 'excellent';
      else if (totalScore >= 70) healthLevel = 'good';
      else if (totalScore >= 50) healthLevel = 'fair';
      else healthLevel = 'poor';

      res.json({
        success: true,
        data: {
          tenantId: targetTenantId,
          tenantName: tenant.name,
          overallHealth: {
            score: totalScore,
            level: healthLevel,
            status: totalScore >= 50 ? 'healthy' : 'needs_attention'
          },
          checks: healthChecks,
          recommendations: generateHealthRecommendations(healthChecks),
          lastChecked: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error checking tenant health:', error);
      next(error);
    }
  }
};

/**
 * Generate health recommendations based on failed checks
 */
function generateHealthRecommendations(healthChecks) {
  const recommendations = [];

  if (!healthChecks.basicConfiguration.status) {
    recommendations.push({
      priority: 'high',
      action: 'Complete basic tenant configuration',
      description: 'Ensure tenant name, domain, and email are properly set'
    });
  }

  if (!healthChecks.brandingSetup.status) {
    recommendations.push({
      priority: 'medium',
      action: 'Configure tenant branding',
      description: 'Set up colors, logo, and activate branding settings'
    });
  }

  if (!healthChecks.userActivity.status) {
    recommendations.push({
      priority: 'high',
      action: 'Add users to the system',
      description: 'Create user accounts to activate the tenant'
    });
  }

  if (!healthChecks.departmentStructure.status) {
    recommendations.push({
      priority: 'medium',
      action: 'Create department structure',
      description: 'Organize users into departments for better management'
    });
  }

  if (!healthChecks.recentActivity.status) {
    recommendations.push({
      priority: 'medium',
      action: 'Encourage user engagement',
      description: 'Promote active usage of the system by your users'
    });
  }

  return recommendations;
}

module.exports = tenantDashboardController;
