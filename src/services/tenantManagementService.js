const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger');
const bcrypt = require('bcryptjs');
const { sendUserInvitationEmail } = require('../utils/emailUtils');

/**
 * Enhanced Tenant Management Service
 * Provides comprehensive tenant administration capabilities
 */

class TenantManagementService {
  
  /**
   * Get comprehensive tenant statistics
   */
  async getTenantStatistics(timeframe = '30d') {
    try {
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
        totalTenants,
        activeTenants,
        suspendedTenants,
        newTenants,
        totalUsers,
        activeUsers,
        tenantGrowth,
        userGrowth,
        tenantsByType,
        tenantsByPlan
      ] = await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { status: 'ACTIVE' } }),
        prisma.tenant.count({ where: { status: 'SUSPENDED' } }),
        prisma.tenant.count({ 
          where: { createdAt: { gte: startDate } } 
        }),
        prisma.user.count(),
        prisma.user.count({ where: { verified: true } }),
        
        // Tenant growth over time
        prisma.tenant.groupBy({
          by: ['createdAt'],
          where: { createdAt: { gte: startDate } },
          _count: { id: true },
          orderBy: { createdAt: 'asc' }
        }),
        
        // User growth over time
        prisma.user.groupBy({
          by: ['createdAt'],
          where: { createdAt: { gte: startDate } },
          _count: { id: true },
          orderBy: { createdAt: 'asc' }
        }),
        
        // Tenants by type
        prisma.tenant.groupBy({
          by: ['type'],
          _count: { id: true }
        }),
        
        // Tenants by subscription plan
        prisma.tenant.groupBy({
          by: ['subscriptionPlan'],
          _count: { id: true }
        })
      ]);

      // Process growth data
      const tenantGrowthData = this.processGrowthData(tenantGrowth);
      const userGrowthData = this.processGrowthData(userGrowth);

      return {
        overview: {
          totalTenants,
          activeTenants,
          suspendedTenants,
          newTenants,
          totalUsers,
          activeUsers,
          tenantActivationRate: totalTenants > 0 ? ((activeTenants / totalTenants) * 100).toFixed(1) : '0',
          userVerificationRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : '0'
        },
        
        growth: {
          tenants: tenantGrowthData,
          users: userGrowthData,
          tenantGrowthRate: this.calculateGrowthRate(tenantGrowthData),
          userGrowthRate: this.calculateGrowthRate(userGrowthData)
        },
        
        distribution: {
          byType: tenantsByType,
          byPlan: tenantsByPlan
        },
        
        timeframe,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error fetching tenant statistics:', error);
      throw new Error('Failed to fetch tenant statistics');
    }
  }

  /**
   * Bulk operations for tenant management
   */
  async bulkCreateUsers(tenantId, usersData, createdBy) {
    try {
      const results = {
        successful: [],
        failed: [],
        summary: {
          total: usersData.length,
          created: 0,
          failed: 0
        }
      };

      // Validate tenant exists and is active
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, status: true }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      if (tenant.status !== 'ACTIVE') {
        throw new Error('Cannot create users for inactive tenant');
      }

      // Process users in transaction batches for better performance
      const batchSize = 10;
      for (let i = 0; i < usersData.length; i += batchSize) {
        const batch = usersData.slice(i, i + batchSize);
        
        await prisma.$transaction(async (tx) => {
          for (const userData of batch) {
            try {
              // Validate required fields
              if (!userData.email || !userData.firstName || !userData.lastName) {
                throw new Error('Missing required fields: email, firstName, lastName');
              }

              // Check for existing user
              const existingUser = await tx.user.findUnique({
                where: { email: userData.email }
              });

              if (existingUser) {
                throw new Error('User with this email already exists');
              }

              // Create user with default password if not provided
              const password = userData.password || this.generateTempPassword();
              const hashedPassword = await bcrypt.hash(password, 12);

              const user = await tx.user.create({
                data: {
                  email: userData.email,
                  firstName: userData.firstName,
                  lastName: userData.lastName,
                  password: hashedPassword,
                  tenantId: tenantId,
                  verified: false, // Require email verification
                  createdBy: createdBy
                }
              });

              // Assign default staff role if no roles specified
              if (!userData.roleIds || userData.roleIds.length === 0) {
                const staffRole = await tx.role.findFirst({
                  where: { 
                    name: 'STAFF',
                    tenantId: tenantId
                  }
                });

                if (staffRole) {
                  await tx.userRole.create({
                    data: {
                      userId: user.id,
                      roleId: staffRole.id,
                      isDefault: true
                    }
                  });
                }
              } else {
                // Assign specified roles
                const roleAssignments = userData.roleIds.map(roleId => ({
                  userId: user.id,
                  roleId: roleId,
                  isDefault: userData.roleIds.indexOf(roleId) === 0
                }));

                await tx.userRole.createMany({
                  data: roleAssignments
                });
              }

              // Send invitation email
              try {
                const invitationLink = `${process.env.CLIENT_URL || 'https://dual-dimension-consulting.vercel.app'}/auth/setup-account?email=${encodeURIComponent(user.email)}&token=${user.id}`;
                await sendUserInvitationEmail(user.email, invitationLink, tenant.name);
              } catch (emailError) {
                logger.warn('Failed to send invitation email', {
                  userId: user.id,
                  email: user.email,
                  error: emailError.message
                });
              }

              results.successful.push({
                email: userData.email,
                userId: user.id,
                tempPassword: !userData.password ? password : null
              });
              results.summary.created++;

            } catch (userError) {
              logger.error('Failed to create user in bulk operation', {
                email: userData.email,
                error: userError.message
              });
              
              results.failed.push({
                email: userData.email,
                error: userError.message
              });
              results.summary.failed++;
            }
          }
        });
      }

      logger.info('Bulk user creation completed', {
        tenantId,
        createdBy,
        summary: results.summary
      });

      return results;

    } catch (error) {
      logger.error('Error in bulk user creation:', error);
      throw new Error(`Bulk user creation failed: ${error.message}`);
    }
  }

  /**
   * Export tenant data for backup or migration
   */
  async exportTenantData(tenantId, options = {}) {
    try {
      const {
        includeUsers = true,
        includeDepartments = true,
        includeRoles = true,
        includeBranding = true,
        includeAuditData = false,
        format = 'json'
      } = options;

      const exportData = {
        exportInfo: {
          tenantId,
          exportedAt: new Date().toISOString(),
          version: '1.0',
          format
        }
      };

      // Base tenant information
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          campuses: true,
          ...(includeBranding && { branding: true })
        }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      exportData.tenant = tenant;

      // Include users if requested
      if (includeUsers) {
        exportData.users = await prisma.user.findMany({
          where: { tenantId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            verified: true,
            createdAt: true,
            updatedAt: true,
            userRoles: {
              include: { role: { select: { name: true, description: true } } }
            },
            userDepartmentRoles: {
              include: {
                role: { select: { name: true, description: true } },
                department: { select: { name: true, code: true } }
              }
            }
          }
        });
      }

      // Include departments if requested
      if (includeDepartments) {
        exportData.departments = await prisma.department.findMany({
          where: { tenantId },
          include: {
            hod: {
              select: { email: true, firstName: true, lastName: true }
            },
            _count: { select: { users: true } }
          }
        });
      }

      // Include roles if requested
      if (includeRoles) {
        exportData.roles = await prisma.role.findMany({
          where: { tenantId },
          include: {
            rolePermissions: {
              include: {
                permission: { select: { module: true, action: true } }
              }
            }
          }
        });
      }

      // Include audit data if requested (optional, may be large)
      if (includeAuditData) {
        exportData.auditPrograms = await prisma.auditProgram.findMany({
          where: { tenantId },
          include: {
            audits: {
              select: {
                id: true,
                title: true,
                status: true,
                createdAt: true,
                updatedAt: true
              }
            }
          }
        });
      }

      logger.info('Tenant data exported successfully', {
        tenantId,
        dataTypes: Object.keys(exportData).filter(key => key !== 'exportInfo'),
        recordCounts: {
          users: exportData.users?.length || 0,
          departments: exportData.departments?.length || 0,
          roles: exportData.roles?.length || 0,
          auditPrograms: exportData.auditPrograms?.length || 0
        }
      });

      return exportData;

    } catch (error) {
      logger.error('Error exporting tenant data:', error);
      throw new Error(`Failed to export tenant data: ${error.message}`);
    }
  }

  /**
   * Tenant health monitoring
   */
  async monitorTenantHealth(tenantId) {
    try {
      const checks = await Promise.all([
        this.checkUserActivity(tenantId),
        this.checkSystemConfiguration(tenantId),
        this.checkResourceUtilization(tenantId),
        this.checkDataIntegrity(tenantId)
      ]);

      const healthScore = this.calculateHealthScore(checks);
      
      return {
        tenantId,
        overallHealth: healthScore,
        checks: {
          userActivity: checks[0],
          systemConfiguration: checks[1],
          resourceUtilization: checks[2],
          dataIntegrity: checks[3]
        },
        recommendations: this.generateHealthRecommendations(checks),
        checkedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error monitoring tenant health:', error);
      throw new Error(`Failed to monitor tenant health: ${error.message}`);
    }
  }

  // Helper methods

  processGrowthData(growthData) {
    const processed = {};
    growthData.forEach(item => {
      const date = item.createdAt.toISOString().split('T')[0];
      processed[date] = (processed[date] || 0) + item._count.id;
    });
    return processed;
  }

  calculateGrowthRate(growthData) {
    const dates = Object.keys(growthData).sort();
    if (dates.length < 2) return 0;
    
    const recent = growthData[dates[dates.length - 1]] || 0;
    const previous = growthData[dates[dates.length - 2]] || 0;
    
    if (previous === 0) return recent > 0 ? 100 : 0;
    return ((recent - previous) / previous * 100).toFixed(1);
  }

  generateTempPassword() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$!%*?&';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async checkUserActivity(tenantId) {
    const [totalUsers, activeUsers, recentLogins] = await Promise.all([
      prisma.user.count({ where: { tenantId } }),
      prisma.user.count({ where: { tenantId, verified: true } }),
      prisma.user.count({
        where: {
          tenantId,
          updatedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    return {
      status: totalUsers > 0 && activeUsers > 0 ? 'healthy' : 'warning',
      metrics: { totalUsers, activeUsers, recentLogins },
      score: Math.min(100, (activeUsers / Math.max(1, totalUsers)) * 100)
    };
  }

  async checkSystemConfiguration(tenantId) {
    const [tenant, departmentCount, roleCount] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { branding: true }
      }),
      prisma.department.count({ where: { tenantId } }),
      prisma.role.count({ where: { tenantId } })
    ]);

    const configComplete = !!(
      tenant?.name && 
      tenant?.domain && 
      tenant?.email &&
      tenant?.branding?.isActive &&
      departmentCount > 0 &&
      roleCount > 0
    );

    return {
      status: configComplete ? 'healthy' : 'warning',
      metrics: { 
        hasBasicInfo: !!(tenant?.name && tenant?.domain && tenant?.email),
        hasBranding: !!tenant?.branding?.isActive,
        hasDepartments: departmentCount > 0,
        hasRoles: roleCount > 0
      },
      score: configComplete ? 100 : 50
    };
  }

  async checkResourceUtilization(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { maxUsers: true, maxStorageGB: true }
    });

    const userCount = await prisma.user.count({ where: { tenantId } });
    
    const userUtilization = tenant?.maxUsers 
      ? (userCount / tenant.maxUsers) * 100 
      : 0;

    return {
      status: userUtilization < 90 ? 'healthy' : 'warning',
      metrics: {
        userCount,
        maxUsers: tenant?.maxUsers,
        userUtilization: userUtilization.toFixed(1)
      },
      score: Math.max(0, 100 - userUtilization)
    };
  }

  async checkDataIntegrity(tenantId) {
    // Check for orphaned records and data consistency
    const [orphanedUsers, unassignedRoles] = await Promise.all([
      prisma.user.count({
        where: {
          tenantId,
          userRoles: { none: {} },
          userDepartmentRoles: { none: {} }
        }
      }),
      prisma.role.count({
        where: {
          tenantId,
          userRoles: { none: {} },
          userDepartmentRoles: { none: {} }
        }
      })
    ]);

    const hasIssues = orphanedUsers > 0 || unassignedRoles > 5; // Allow some unused roles

    return {
      status: !hasIssues ? 'healthy' : 'warning',
      metrics: { orphanedUsers, unassignedRoles },
      score: hasIssues ? 70 : 100
    };
  }

  calculateHealthScore(checks) {
    const totalScore = checks.reduce((sum, check) => sum + check.score, 0);
    const avgScore = totalScore / checks.length;
    
    let level;
    if (avgScore >= 85) level = 'excellent';
    else if (avgScore >= 70) level = 'good';
    else if (avgScore >= 50) level = 'fair';
    else level = 'poor';

    return {
      score: Math.round(avgScore),
      level,
      status: avgScore >= 70 ? 'healthy' : 'needs_attention'
    };
  }

  generateHealthRecommendations(checks) {
    const recommendations = [];

    const [userActivity, systemConfig, resourceUtil, dataIntegrity] = checks;

    if (userActivity.score < 70) {
      recommendations.push({
        priority: 'high',
        category: 'user_engagement',
        title: 'Improve User Activity',
        description: 'Low user engagement detected. Consider user training or system improvements.'
      });
    }

    if (systemConfig.score < 70) {
      recommendations.push({
        priority: 'high',
        category: 'configuration',
        title: 'Complete System Configuration',
        description: 'System configuration is incomplete. Review branding, departments, and roles.'
      });
    }

    if (resourceUtil.score < 30) {
      recommendations.push({
        priority: 'medium',
        category: 'resources',
        title: 'Monitor Resource Usage',
        description: 'Resource utilization is high. Consider upgrading limits or optimizing usage.'
      });
    }

    if (dataIntegrity.score < 70) {
      recommendations.push({
        priority: 'medium',
        category: 'maintenance',
        title: 'Data Cleanup Required',
        description: 'Data integrity issues detected. Clean up orphaned records and unused roles.'
      });
    }

    return recommendations;
  }
}

module.exports = new TenantManagementService();
