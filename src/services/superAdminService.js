/**
 * ENTERPRISE SUPER ADMIN SERVICE
 * Handles global tenant management and system-wide operations
 */

const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger');
const tenantService = require('./tenantService');
const bcrypt = require('bcryptjs');

class SuperAdminService {
  
  /**
   * Create Super Admin User (Global Scope)
   * Super Admin can manage all tenants
   */
  async createSuperAdmin({ email, firstName, lastName, password, createdBy }) {
    return prisma.$transaction(async (tx) => {
      // 1. Check if super admin already exists
      const existingSuperAdmin = await tx.userRole.findFirst({
        where: {
          role: { name: 'SUPER_ADMIN' }
        },
        include: { user: true }
      });

      if (existingSuperAdmin) {
        throw new Error('Super Admin already exists. Only one Super Admin allowed per system.');
      }

      // 2. Get or create SUPER_ADMIN role in Default Tenant
      let superAdminRole = await tx.role.findFirst({
        where: { 
          name: 'SUPER_ADMIN',
          tenantId: 'default-tenant'
        }
      });

      if (!superAdminRole) {
        superAdminRole = await tx.role.create({
          data: {
            id: 'default-tenant-super_admin',
            name: 'SUPER_ADMIN',
            description: 'Global System Administrator with access to all tenants',
            tenantId: 'default-tenant',
            loginDestination: '/super-admin-dashboard',
            defaultContext: 'global',
            isDefault: true,
            isRemovable: false
          }
        });
      }

      // 3. Hash password
      const hashedPassword = await bcrypt.hash(password, 12); // Higher salt rounds for super admin

      // 4. Create super admin user in Default Tenant
      const superAdminUser = await tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          password: hashedPassword,
          tenantId: 'default-tenant',
          verified: true,
          createdBy: createdBy || 'SYSTEM',
          isSystemUser: true // Flag for system-level user
        }
      });

      // 5. Assign SUPER_ADMIN role
      await tx.userRole.create({
        data: {
          userId: superAdminUser.id,
          roleId: superAdminRole.id,
          isDefault: true
        }
      });

      logger.info('Super Admin created', {
        userId: superAdminUser.id,
        email: superAdminUser.email,
        createdBy
      });

      return superAdminUser;
    });
  }

  /**
   * Get All Tenants with Analytics (Super Admin Only)
   */
  async getAllTenantsWithAnalytics() {
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            roles: true,
            departments: true,
            campuses: true,
            auditPrograms: true
          }
        },
        branding: {
          select: {
            primaryColor: true,
            secondaryColor: true,
            tagline: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Add computed analytics
    return await Promise.all(tenants.map(async (tenant) => {
      const [activeUsers, recentActivity] = await Promise.all([
        prisma.user.count({
          where: { 
            tenantId: tenant.id,
            verified: true 
          }
        }),
        prisma.user.count({
          where: {
            tenantId: tenant.id,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
            }
          }
        })
      ]);

      return {
        ...tenant,
        analytics: {
          activeUsers,
          recentActivity,
          utilizationRate: tenant._count.users > 0 ? (activeUsers / tenant._count.users * 100).toFixed(1) : 0
        }
      };
    }));
  }

  /**
   * Cross-Tenant User Management (Super Admin Only)
   */
  async moveUserBetweenTenants({ userId, fromTenantId, toTenantId, superAdminId }) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify super admin permissions
      await this.verifySuperAdminAccess(superAdminId, tx);

      // 2. Get user and validate
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: { include: { role: true } },
          userDepartmentRoles: { include: { role: true, department: true } }
        }
      });

      if (!user || user.tenantId !== fromTenantId) {
        throw new Error('User not found or tenant mismatch');
      }

      // 3. Check if user is HOD - cannot move HODs
      const hodDepartments = await tx.department.findMany({
        where: { hodId: userId, tenantId: fromTenantId }
      });

      if (hodDepartments.length > 0) {
        throw new Error('Cannot move user who is Head of Department. Reassign HOD first.');
      }

      // 4. Clean up old tenant assignments
      await tx.userRole.deleteMany({ where: { userId } });
      await tx.userDepartmentRole.deleteMany({ where: { userId } });

      // 5. Move user to new tenant
      await tx.user.update({
        where: { id: userId },
        data: { tenantId: toTenantId }
      });

      // 6. Assign default STAFF role in new tenant
      const staffRole = await tx.role.findFirst({
        where: { name: 'STAFF', tenantId: toTenantId }
      });

      if (staffRole) {
        await tx.userRole.create({
          data: {
            userId,
            roleId: staffRole.id,
            isDefault: true
          }
        });
      }

      logger.info('User moved between tenants', {
        userId,
        fromTenantId,
        toTenantId,
        superAdminId
      });

      return { success: true };
    });
  }

  /**
   * Global Role Analysis (Super Admin Only)
   */
  async getGlobalRoleAnalysis() {
    const roleAnalysis = await prisma.role.groupBy({
      by: ['name', 'tenantId'],
      _count: {
        userRoles: true,
        userDepartmentRoles: true
      },
      orderBy: [
        { name: 'asc' },
        { tenantId: 'asc' }
      ]
    });

    // Detect role inconsistencies
    const roleNames = [...new Set(roleAnalysis.map(r => r.name))];
    const inconsistencies = [];

    for (const roleName of roleNames) {
      const roleInstances = roleAnalysis.filter(r => r.name === roleName);
      if (roleInstances.length > 1) {
        // Check for permission inconsistencies
        const permissions = await prisma.rolePermission.findMany({
          where: {
            role: {
              name: roleName
            }
          },
          include: {
            role: { select: { tenantId: true } },
            permission: { select: { name: true, action: true } }
          }
        });

        const permissionsByTenant = permissions.reduce((acc, rp) => {
          if (!acc[rp.role.tenantId]) acc[rp.role.tenantId] = [];
          acc[rp.role.tenantId].push(`${rp.permission.action}:${rp.permission.name}`);
          return acc;
        }, {});

        // Check if all tenants have same permissions for this role
        const tenantIds = Object.keys(permissionsByTenant);
        if (tenantIds.length > 1) {
          const basePermissions = permissionsByTenant[tenantIds[0]]?.sort() || [];
          const hasInconsistency = tenantIds.some(tenantId => {
            const tenantPermissions = permissionsByTenant[tenantId]?.sort() || [];
            return JSON.stringify(basePermissions) !== JSON.stringify(tenantPermissions);
          });

          if (hasInconsistency) {
            inconsistencies.push({
              roleName,
              tenants: tenantIds,
              permissionsByTenant
            });
          }
        }
      }
    }

    return {
      roleDistribution: roleAnalysis,
      inconsistencies,
      totalRoles: roleAnalysis.length,
      uniqueRoleNames: roleNames.length
    };
  }

  /**
   * System Health Check (Super Admin Only)
   */
  async performSystemHealthCheck() {
    const healthChecks = {
      tenantIsolation: await this.checkTenantIsolation(),
      roleHierarchy: await this.checkRoleHierarchy(),
      permissionCoverage: await this.checkPermissionCoverage(),
      dataIntegrity: await this.checkDataIntegrity(),
      performanceMetrics: await this.getPerformanceMetrics()
    };

    const overallHealth = this.calculateHealthScore(healthChecks);

    return {
      ...healthChecks,
      overallHealth,
      timestamp: new Date(),
      recommendations: this.generateRecommendations(healthChecks)
    };
  }

  /**
   * Verify Super Admin Access
   */
  async verifySuperAdminAccess(userId, tx = prisma) {
    const superAdminRole = await tx.userRole.findFirst({
      where: {
        userId,
        role: { name: 'SUPER_ADMIN' }
      }
    });

    if (!superAdminRole) {
      throw new Error('Access denied. Super Admin privileges required.');
    }

    return true;
  }

  /**
   * Private helper methods
   */
  async checkTenantIsolation() {
    // Check for cross-tenant contamination
    const crossTenantIssues = await prisma.userRole.findMany({
      where: {
        user: {
          tenantId: {
            not: { equals: prisma.role.fields.tenantId }
          }
        }
      },
      include: {
        user: { select: { tenantId: true, email: true } },
        role: { select: { tenantId: true, name: true } }
      }
    });

    return {
      status: crossTenantIssues.length === 0 ? 'HEALTHY' : 'ISSUES_DETECTED',
      issueCount: crossTenantIssues.length,
      issues: crossTenantIssues.slice(0, 10) // Limit for performance
    };
  }

  async checkRoleHierarchy() {
    const requiredRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PRINCIPAL', 'MR', 'HOD', 'STAFF'];
    const existingRoles = await prisma.role.groupBy({
      by: ['name'],
      _count: { name: true }
    });

    const existingRoleNames = existingRoles.map(r => r.name);
    const missingRoles = requiredRoles.filter(role => !existingRoleNames.includes(role));

    return {
      status: missingRoles.length === 0 ? 'COMPLETE' : 'INCOMPLETE',
      missingRoles,
      totalRoles: existingRoles.length,
      requiredRoles: requiredRoles.length
    };
  }

  async checkPermissionCoverage() {
    const permissions = await prisma.permission.findMany({
      include: {
        _count: { select: { rolePermissions: true } }
      }
    });

    const orphanedPermissions = permissions.filter(p => p._count.rolePermissions === 0);

    return {
      status: orphanedPermissions.length === 0 ? 'OPTIMAL' : 'NEEDS_CLEANUP',
      totalPermissions: permissions.length,
      orphanedPermissions: orphanedPermissions.length,
      coverageRate: ((permissions.length - orphanedPermissions.length) / permissions.length * 100).toFixed(1)
    };
  }

  async checkDataIntegrity() {
    // Check for orphaned records
    const orphanedUserRoles = await prisma.userRole.findMany({
      where: {
        OR: [
          { user: null },
          { role: null }
        ]
      }
    });

    const orphanedDeptRoles = await prisma.userDepartmentRole.findMany({
      where: {
        OR: [
          { user: null },
          { role: null }
        ]
      }
    });

    return {
      status: (orphanedUserRoles.length + orphanedDeptRoles.length) === 0 ? 'CLEAN' : 'NEEDS_CLEANUP',
      orphanedUserRoles: orphanedUserRoles.length,
      orphanedDeptRoles: orphanedDeptRoles.length
    };
  }

  async getPerformanceMetrics() {
    const startTime = Date.now();
    
    // Simulate common operations to measure performance
    await Promise.all([
      prisma.user.count(),
      prisma.role.count(),
      prisma.tenant.count(),
      prisma.permission.count()
    ]);

    const queryTime = Date.now() - startTime;

    return {
      status: queryTime < 1000 ? 'FAST' : queryTime < 3000 ? 'MODERATE' : 'SLOW',
      queryTime,
      benchmark: 'Sub-1000ms for basic operations'
    };
  }

  calculateHealthScore(healthChecks) {
    const scores = {
      tenantIsolation: healthChecks.tenantIsolation.status === 'HEALTHY' ? 100 : 0,
      roleHierarchy: healthChecks.roleHierarchy.status === 'COMPLETE' ? 100 : 50,
      permissionCoverage: parseFloat(healthChecks.permissionCoverage.coverageRate),
      dataIntegrity: healthChecks.dataIntegrity.status === 'CLEAN' ? 100 : 0,
      performance: healthChecks.performanceMetrics.status === 'FAST' ? 100 : 
                  healthChecks.performanceMetrics.status === 'MODERATE' ? 70 : 30
    };

    return Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length);
  }

  generateRecommendations(healthChecks) {
    const recommendations = [];

    if (healthChecks.tenantIsolation.status !== 'HEALTHY') {
      recommendations.push('Fix cross-tenant contamination immediately');
    }

    if (healthChecks.roleHierarchy.status !== 'COMPLETE') {
      recommendations.push(`Create missing roles: ${healthChecks.roleHierarchy.missingRoles.join(', ')}`);
    }

    if (healthChecks.permissionCoverage.orphanedPermissions > 0) {
      recommendations.push('Clean up orphaned permissions');
    }

    if (healthChecks.dataIntegrity.status !== 'CLEAN') {
      recommendations.push('Clean up orphaned user role assignments');
    }

    if (healthChecks.performanceMetrics.status !== 'FAST') {
      recommendations.push('Optimize database queries and add indexes');
    }

    return recommendations;
  }
}

module.exports = new SuperAdminService();
