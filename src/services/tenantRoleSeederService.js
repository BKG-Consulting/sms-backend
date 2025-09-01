const { prisma } = require('../../prisma/client');
const { getAvailableRoles, getRoleDescription } = require('../../constants/rolePermissions');
const rolePermissionService = require('./rolePermissionService');
const { logger } = require('../utils/logger');

/**
 * Seeds all predefined role templates for a tenant
 * This ensures that when users are created, all standard roles are available
 */
async function seedRolesForTenant(tenantId, createdBy = 'system') {
  try {
    logger.info('Starting role seeding for tenant', { tenantId });
    
    // Get all predefined role templates
    const predefinedRoles = getAvailableRoles();
    
    // Check which roles already exist for this tenant
    const existingRoles = await prisma.role.findMany({
      where: { tenantId },
      select: { name: true, id: true }
    });
    
    const existingRoleNames = existingRoles.map(r => r.name.toUpperCase());
    
    // Find missing roles that need to be created
    const missingRoles = predefinedRoles.filter(roleName => 
      !existingRoleNames.includes(roleName)
    );
    
    if (missingRoles.length === 0) {
      logger.info('All predefined roles already exist for tenant', { tenantId, existingCount: existingRoles.length });
      return { created: 0, existing: existingRoles.length, roles: existingRoles };
    }
    
    logger.info('Creating missing roles for tenant', { 
      tenantId, 
      missing: missingRoles, 
      existing: existingRoleNames 
    });
    
    const createdRoles = [];
    
    // Create missing roles with transaction for atomicity
    await prisma.$transaction(async (tx) => {
      for (const roleName of missingRoles) {
        try {
          // Create the role
          const roleId = `${tenantId}-${roleName.toLowerCase()}`;
          const description = getRoleDescription(roleName);
          
          const role = await tx.role.create({
            data: {
              id: roleId,
              name: roleName,
              description: description || `${roleName} role`,
              tenantId: tenantId,
              isDefault: false,
              isRemovable: true,
              loginDestination: '/dashboard',
              defaultContext: 'dashboard',
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          });
          
          createdRoles.push(role);
          
          logger.info('Created role for tenant', { 
            tenantId, 
            roleId: role.id, 
            roleName: role.name 
          });
          
        } catch (error) {
          logger.error('Failed to create role', { 
            tenantId, 
            roleName, 
            error: error.message 
          });
          throw error;
        }
      }
    });
    
    // Assign permissions to newly created roles (outside transaction for better error handling)
    for (const role of createdRoles) {
      try {
        await rolePermissionService.assignRolePermissionsFromMatrix(role.id, role.name);
        logger.info('Assigned permissions to role', { 
          tenantId, 
          roleId: role.id, 
          roleName: role.name 
        });
      } catch (error) {
        logger.warn('Failed to assign permissions to role', { 
          tenantId, 
          roleId: role.id, 
          roleName: role.name, 
          error: error.message 
        });
        // Don't throw here - role creation was successful, permission assignment is recoverable
      }
    }
    
    logger.info('Role seeding completed for tenant', { 
      tenantId, 
      created: createdRoles.length, 
      existing: existingRoles.length,
      total: createdRoles.length + existingRoles.length
    });
    
    return {
      created: createdRoles.length,
      existing: existingRoles.length,
      roles: [...existingRoles, ...createdRoles]
    };
    
  } catch (error) {
    logger.error('Role seeding failed for tenant', { 
      tenantId, 
      error: error.message 
    });
    throw new Error(`Failed to seed roles for tenant: ${error.message}`);
  }
}

/**
 * Ensures a specific role exists for a tenant, creating it if missing
 */
async function ensureRoleForTenant(tenantId, roleName, createdBy = 'system') {
  try {
    // Check if role already exists
    const existingRole = await prisma.role.findFirst({
      where: { 
        tenantId, 
        name: { equals: roleName, mode: 'insensitive' }
      }
    });
    
    if (existingRole) {
      return existingRole;
    }
    
    // Create the role if it doesn't exist
    const roleId = `${tenantId}-${roleName.toLowerCase()}`;
    const description = getRoleDescription(roleName) || `${roleName} role`;
    
    const role = await prisma.role.create({
      data: {
        id: roleId,
        name: roleName.toUpperCase(),
        description: description,
        tenantId: tenantId,
        isDefault: false,
        isRemovable: true,
        loginDestination: '/dashboard',
        defaultContext: 'dashboard',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });
    
    // Assign permissions if it's a predefined role
    const predefinedRoles = getAvailableRoles();
    if (predefinedRoles.includes(roleName.toUpperCase())) {
      try {
        await rolePermissionService.assignRolePermissionsFromMatrix(role.id, roleName);
        logger.info('Assigned permissions to newly created role', { 
          tenantId, 
          roleId: role.id, 
          roleName 
        });
      } catch (error) {
        logger.warn('Failed to assign permissions to newly created role', { 
          tenantId, 
          roleId: role.id, 
          roleName, 
          error: error.message 
        });
      }
    }
    
    logger.info('Created missing role for tenant', { 
      tenantId, 
      roleId: role.id, 
      roleName 
    });
    
    return role;
    
  } catch (error) {
    logger.error('Failed to ensure role for tenant', { 
      tenantId, 
      roleName, 
      error: error.message 
    });
    throw error;
  }
}

module.exports = {
  seedRolesForTenant,
  ensureRoleForTenant
};
