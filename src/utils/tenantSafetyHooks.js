/**
 * Database safety hooks and utilities for multi-tenant data integrity
 * These hooks prevent accidental cross-tenant data leaks and ensure data integrity
 */

const { logger } = require('./logger');
const { prisma } = require('../../prisma/client');

/**
 * Pre-operation hooks to validate tenant boundaries
 */
class TenantSafetyHooks {
  
  /**
   * Validates that all referenced entities belong to the same tenant
   */
  static async validateTenantConsistency(operation, data, userTenantId) {
    const validations = [];

    // User assignments
    if (data.userId || data.userIds) {
      const userIds = Array.isArray(data.userIds) ? data.userIds : [data.userId].filter(Boolean);
      if (userIds.length > 0) {
        validations.push(this.validateUsers(userIds, userTenantId));
      }
    }

    // Role assignments
    if (data.roleId || data.roleIds) {
      const roleIds = Array.isArray(data.roleIds) ? data.roleIds : [data.roleId].filter(Boolean);
      if (roleIds.length > 0) {
        validations.push(this.validateRoles(roleIds, userTenantId));
      }
    }

    // Department assignments
    if (data.departmentId || data.departmentIds) {
      const deptIds = Array.isArray(data.departmentIds) ? data.departmentIds : [data.departmentId].filter(Boolean);
      if (deptIds.length > 0) {
        validations.push(this.validateDepartments(deptIds, userTenantId));
      }
    }

    // Audit Program references
    if (data.auditProgramId) {
      validations.push(this.validateAuditProgram(data.auditProgramId, userTenantId));
    }

    // Execute all validations
    const results = await Promise.all(validations);
    const failures = results.filter(result => !result.valid);

    if (failures.length > 0) {
      logger.error('Tenant consistency validation failed', {
        operation,
        userTenantId,
        failures: failures.map(f => ({ type: f.type, ids: f.invalidIds }))
      });
      
      throw new Error(`Tenant validation failed: ${failures.map(f => 
        `${f.invalidIds.length} invalid ${f.type}(s)`
      ).join(', ')}`);
    }

    return true;
  }

  static async validateUsers(userIds, tenantId) {
    const users = await prisma.user.findMany({
      where: { 
        id: { in: userIds },
        tenantId: tenantId 
      },
      select: { id: true }
    });

    const validIds = users.map(u => u.id);
    const invalidIds = userIds.filter(id => !validIds.includes(id));

    return {
      valid: invalidIds.length === 0,
      type: 'user',
      invalidIds
    };
  }

  static async validateRoles(roleIds, tenantId) {
    const roles = await prisma.role.findMany({
      where: { 
        id: { in: roleIds },
        tenantId: tenantId 
      },
      select: { id: true }
    });

    const validIds = roles.map(r => r.id);
    const invalidIds = roleIds.filter(id => !validIds.includes(id));

    return {
      valid: invalidIds.length === 0,
      type: 'role',
      invalidIds
    };
  }

  static async validateDepartments(departmentIds, tenantId) {
    const departments = await prisma.department.findMany({
      where: { 
        id: { in: departmentIds },
        tenantId: tenantId 
      },
      select: { id: true }
    });

    const validIds = departments.map(d => d.id);
    const invalidIds = departmentIds.filter(id => !validIds.includes(id));

    return {
      valid: invalidIds.length === 0,
      type: 'department',
      invalidIds
    };
  }

  static async validateAuditProgram(auditProgramId, tenantId) {
    const auditProgram = await prisma.auditProgram.findFirst({
      where: { 
        id: auditProgramId,
        tenantId: tenantId 
      },
      select: { id: true }
    });

    return {
      valid: !!auditProgram,
      type: 'auditProgram',
      invalidIds: auditProgram ? [] : [auditProgramId]
    };
  }

  /**
   * Automatically inject tenant ID into create operations
   */
  static injectTenantId(data, userTenantId) {
    if (!userTenantId) {
      throw new Error('User tenant ID required for data creation');
    }

    return {
      ...data,
      tenantId: userTenantId
    };
  }

  /**
   * Validate that update operations don't cross tenant boundaries
   */
  static async validateUpdatePermissions(model, recordId, userTenantId) {
    let record = null;

    switch (model) {
      case 'user':
        record = await prisma.user.findUnique({
          where: { id: recordId },
          select: { tenantId: true }
        });
        break;
      case 'role':
        record = await prisma.role.findUnique({
          where: { id: recordId },
          select: { tenantId: true }
        });
        break;
      case 'department':
        record = await prisma.department.findUnique({
          where: { id: recordId },
          select: { tenantId: true }
        });
        break;
      case 'auditProgram':
        record = await prisma.auditProgram.findUnique({
          where: { id: recordId },
          select: { tenantId: true }
        });
        break;
      // Add more models as needed
      default:
        logger.warn('Unknown model for tenant validation', { model, recordId });
        return false;
    }

    if (!record) {
      logger.warn('Record not found for tenant validation', { model, recordId });
      return false;
    }

    if (record.tenantId !== userTenantId) {
      logger.error('Cross-tenant update attempt blocked', {
        model,
        recordId,
        recordTenantId: record.tenantId,
        userTenantId
      });
      return false;
    }

    return true;
  }

  /**
   * Database integrity check for tenant isolation
   */
  static async performIntegrityCheck(tenantId) {
    const checks = [];

    // Check for orphaned records (records without proper tenant association)
    checks.push(this.checkOrphanedRecords(tenantId));
    
    // Check for cross-tenant references
    checks.push(this.checkCrossTenantReferences(tenantId));
    
    // Check for data consistency
    checks.push(this.checkDataConsistency(tenantId));

    const results = await Promise.all(checks);
    
    return {
      tenantId,
      timestamp: new Date().toISOString(),
      results: results.reduce((acc, result) => ({ ...acc, ...result }), {})
    };
  }

  static async checkOrphanedRecords(tenantId) {
    // Check for users without valid tenant references
    const orphanedUsers = await prisma.user.count({
      where: {
        tenantId: tenantId,
        tenant: null
      }
    });

    // Check for roles assigned to users from different tenants
    const crossTenantRoles = await prisma.userRole.count({
      where: {
        user: { tenantId: tenantId },
        role: { tenantId: { not: tenantId } }
      }
    });

    return {
      orphanedRecords: {
        orphanedUsers,
        crossTenantRoles
      }
    };
  }

  static async checkCrossTenantReferences(tenantId) {
    // Check for audit programs referencing users from other tenants
    const invalidAuditAssignments = await prisma.audit.count({
      where: {
        auditProgram: { tenantId: tenantId },
        OR: [
          { leadAuditor: { tenantId: { not: tenantId } } },
          { team: { some: { auditor: { tenantId: { not: tenantId } } } } }
        ]
      }
    });

    return {
      crossTenantReferences: {
        invalidAuditAssignments
      }
    };
  }

  static async checkDataConsistency(tenantId) {
    // Check for department HODs from other tenants
    const invalidHODs = await prisma.department.count({
      where: {
        tenantId: tenantId,
        hod: { tenantId: { not: tenantId } }
      }
    });

    return {
      dataConsistency: {
        invalidHODs
      }
    };
  }
}

/**
 * Wrapper function to create tenant-safe service operations
 */
function createTenantSafeService(userTenantId) {
  return {
    async create(model, data) {
      // Auto-inject tenant ID
      const safeData = TenantSafetyHooks.injectTenantId(data, userTenantId);
      
      // Validate tenant consistency
      await TenantSafetyHooks.validateTenantConsistency('create', safeData, userTenantId);
      
      return safeData;
    },

    async update(model, recordId, data) {
      // Validate permissions
      const canUpdate = await TenantSafetyHooks.validateUpdatePermissions(model, recordId, userTenantId);
      
      if (!canUpdate) {
        throw new Error(`Access denied: Cannot update ${model} record`);
      }

      // Validate tenant consistency for references
      await TenantSafetyHooks.validateTenantConsistency('update', data, userTenantId);
      
      return data;
    }
  };
}

module.exports = {
  TenantSafetyHooks,
  createTenantSafeService
};

