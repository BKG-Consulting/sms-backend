const { prisma } = require('../../prisma/client');
const { getRolePermissions, getFlattenedPermissions } = require('../../constants/rolePermissions');
const { logger } = require('../utils/logger');

const rolePermissionService = {
  /**
   * Get role permissions for multiple roles
   * @param {Array} roleIds - Array of role IDs
   * @returns {Promise<Array>} - Array of role permissions
   */
  getRolePermissionsForRoles: async (roleIds) => {
    try {
      const rolePermissions = await prisma.rolePermission.findMany({
        where: { 
          roleId: { in: roleIds }
        },
        include: {
          permission: true,
        },
      });

      return rolePermissions;
    } catch (error) {
      logger.error('Error fetching role permissions for multiple roles', { roleIds, error: error.message });
      throw error;
    }
  },

  /**
   * Assign specific permissions to a role
   * @param {string} roleId - The role ID
   * @param {Array} permissionIds - Array of permission IDs to assign
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Object>} - Result with assigned permissions count
   */
  assignSpecificPermissionsToRole: async (roleId, permissionIds, tenantId) => {
    try {
      logger.info('Assigning specific permissions to role', { roleId, permissionIds, tenantId });

      if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
        logger.warn('No permission IDs provided for role', { roleId });
        return { assignedCount: 0, message: 'No permissions provided' };
      }

      // Verify all permissions exist
      const permissions = await prisma.permission.findMany({
        where: {
          id: { in: permissionIds }
        }
      });

      if (permissions.length !== permissionIds.length) {
        const foundIds = permissions.map(p => p.id);
        const missingIds = permissionIds.filter(id => !foundIds.includes(id));
        logger.error('Some permissions not found', { roleId, missingIds });
        throw new Error(`Some permissions not found: ${missingIds.join(', ')}`);
      }

      // Use transaction to ensure all permissions are assigned atomically
      const result = await prisma.$transaction(async (tx) => {
        // Delete existing role permissions for this role
        await tx.rolePermission.deleteMany({
          where: { roleId }
        });

        // Create new role permissions
        const rolePermissionData = permissionIds.map(permissionId => ({
          roleId,
          permissionId,
          allowed: true,
        }));

        const createdRolePermissions = await tx.rolePermission.createMany({
          data: rolePermissionData,
          skipDuplicates: true,
        });

        return createdRolePermissions;
      });

      logger.info('Successfully assigned specific permissions to role', {
        roleId,
        assignedCount: result.count,
        totalPermissions: permissionIds.length
      });

      return {
        assignedCount: result.count,
        totalPermissions: permissionIds.length,
        message: `Successfully assigned ${result.count} permissions to role`
      };

    } catch (error) {
      logger.error('Error assigning specific permissions to role', {
        roleId,
        permissionIds,
        tenantId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Automatically assign permissions to a role based on the role-permission matrix
   * @param {string} roleId - The role ID
   * @param {string} roleName - The role name (e.g., 'MR', 'PRINCIPAL')
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Object>} - Result with assigned permissions count
   */
  assignPermissionsToRole: async (roleId, roleName, tenantId) => {
    try {
      logger.info('Assigning permissions to role', { roleId, roleName, tenantId });

      // Get the role permissions from the matrix
      const roleConfig = getRolePermissions(roleName);
      if (!roleConfig) {
        throw new Error(`No permission configuration found for role: ${roleName}`);
      }

      // Get flattened permissions for this role
      const flattenedPermissions = getFlattenedPermissions(roleName);
      if (flattenedPermissions.length === 0) {
        logger.warn('No permissions found for role', { roleName });
        return { assignedCount: 0, message: 'No permissions configured for this role' };
      }

      // Get all permissions from database
      const allPermissions = await prisma.permission.findMany();
      
      // Create a map for quick lookup
      const permissionMap = new Map();
      allPermissions.forEach(perm => {
        const key = `${perm.module}:${perm.action}`;
        permissionMap.set(key, perm);
      });

      // Find permissions that exist in database and match our matrix
      const permissionsToAssign = [];
      flattenedPermissions.forEach(({ module, action }) => {
        const key = `${module}:${action}`;
        const permission = permissionMap.get(key);
        if (permission) {
          permissionsToAssign.push({
            roleId,
            permissionId: permission.id,
            allowed: true,
          });
        } else {
          logger.warn('Permission not found in database', { module, action, key });
        }
      });

      if (permissionsToAssign.length === 0) {
        logger.warn('No valid permissions found to assign', { roleName });
        return { assignedCount: 0, message: 'No valid permissions found to assign' };
      }

      // Use transaction to ensure all permissions are assigned atomically
      const result = await prisma.$transaction(async (tx) => {
        // Delete existing role permissions for this role
        await tx.rolePermission.deleteMany({
          where: { roleId }
        });

        // Create new role permissions
        const createdRolePermissions = await tx.rolePermission.createMany({
          data: permissionsToAssign,
          skipDuplicates: true,
        });

        return createdRolePermissions;
      });

      logger.info('Successfully assigned permissions to role', {
        roleId,
        roleName,
        assignedCount: result.count,
        totalPermissions: permissionsToAssign.length
      });

      return {
        assignedCount: result.count,
        totalPermissions: permissionsToAssign.length,
        message: `Successfully assigned ${result.count} permissions to role ${roleName}`
      };

    } catch (error) {
      logger.error('Error assigning permissions to role', {
        roleId,
        roleName,
        tenantId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Assign permissions to a role based on the permission matrix
   * @param {string} roleId - The role ID
   * @param {string} roleName - The role name (e.g., 'SYSTEM_ADMIN', 'MR', etc.)
   * @param {object} tx - Prisma transaction (optional)
   */
  assignRolePermissionsFromMatrix: async (roleId, roleName, tx = null) => {
    try {
      const prismaClient = tx || prisma;
      
      // Get the flattened permissions for this role from the matrix
      const rolePermissions = getFlattenedPermissions(roleName);
      
      if (!rolePermissions || rolePermissions.length === 0) {
        logger.warn(`No permissions found for role: ${roleName}`);
        return [];
      }

      // Get all available permissions from the database
      const allPermissions = await prismaClient.permission.findMany();
      
      // Create a map of module:action to permission ID for quick lookup
      const permissionMap = new Map();
      allPermissions.forEach(perm => {
        const key = `${perm.module}:${perm.action}`;
        permissionMap.set(key, perm.id);
      });

      // Prepare role permission data
      const rolePermissionData = [];
      rolePermissions.forEach(({ module, action }) => {
        const key = `${module}:${action}`;
        const permissionId = permissionMap.get(key);
        
        if (permissionId) {
          rolePermissionData.push({
            roleId,
            permissionId,
            allowed: true,
          });
        } else {
          logger.warn(`Permission not found in database: ${module}.${action}`);
        }
      });

      if (rolePermissionData.length === 0) {
        logger.warn(`No valid permissions found for role: ${roleName}`);
        return [];
      }

      // Create role permissions
      const createdPermissions = await prismaClient.rolePermission.createMany({
        data: rolePermissionData,
        skipDuplicates: true,
      });

      logger.info(`Assigned ${rolePermissionData.length} permissions to role: ${roleName}`);
      return rolePermissionData;
    } catch (error) {
      logger.error('Error assigning role permissions from matrix:', error);
      throw error;
    }
  },

  /**
   * Get all permissions for a specific role
   * @param {string} roleId - The role ID
   * @returns {Promise<Array>} - Array of role permissions
   */
  getRolePermissions: async (roleId) => {
    try {
      const rolePermissions = await prisma.rolePermission.findMany({
        where: { roleId },
        include: {
          permission: true,
        },
      });

      return rolePermissions;
    } catch (error) {
      logger.error('Error fetching role permissions', { roleId, error: error.message });
      throw error;
    }
  },

  /**
   * Update a specific role permission
   * @param {string} roleId - The role ID
   * @param {string} permissionId - The permission ID
   * @param {boolean} allowed - Whether the permission is allowed
   * @returns {Promise<Object>} - Updated role permission
   */
  updateRolePermission: async (roleId, permissionId, allowed) => {
    try {
      const rolePermission = await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId, permissionId }
        },
        update: { allowed },
        create: {
          roleId,
          permissionId,
          allowed,
        },
      });

      logger.info('Updated role permission', { roleId, permissionId, allowed });
      return rolePermission;
    } catch (error) {
      logger.error('Error updating role permission', {
        roleId,
        permissionId,
        allowed,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Batch update role permissions
   * @param {Array} updates - Array of { roleId, permissionId, allowed }
   * @returns {Promise<Object>} - Result with updated count
   */
  batchUpdateRolePermissions: async (updates) => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const results = [];
        for (const update of updates) {
          const { roleId, permissionId, allowed } = update;
          const rolePermission = await tx.rolePermission.upsert({
            where: {
              roleId_permissionId: { roleId, permissionId }
            },
            update: { allowed },
            create: {
              roleId,
              permissionId,
              allowed,
            },
          });
          results.push(rolePermission);
        }
        return results;
      });

      logger.info('Batch updated role permissions', { updatedCount: result.length });
      return { updatedCount: result.length, results };
    } catch (error) {
      logger.error('Error batch updating role permissions', { error: error.message });
      throw error;
    }
  },

  /**
   * Get all permissions for all roles in a tenant
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Object>} - Object with roles, permissions, and role permissions
   */
  getTenantRolePermissions: async (tenantId) => {
    try {
      const roles = await prisma.role.findMany({
        where: { tenantId },
        select: { id: true, name: true, description: true }
      });

      const permissions = await prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { action: 'asc' }]
      });

      const rolePermissions = await prisma.rolePermission.findMany({
        where: {
          roleId: { in: roles.map(r => r.id) }
        },
        include: {
          permission: true,
        },
      });

      return { roles, permissions, rolePermissions };
    } catch (error) {
      logger.error('Error fetching tenant role permissions', { tenantId, error: error.message });
      throw error;
    }
  },

  /**
   * Delete all permissions for a role
   * @param {string} roleId - The role ID
   * @returns {Promise<Object>} - Result with deleted count
   */
  deleteRolePermissions: async (roleId) => {
    try {
      const result = await prisma.rolePermission.deleteMany({
        where: { roleId }
      });

      logger.info('Deleted role permissions', { roleId, deletedCount: result.count });
      return result;
    } catch (error) {
      logger.error('Error deleting role permissions', { roleId, error: error.message });
      throw error;
    }
  },

  /**
   * Reset role permissions to default based on role matrix
   * @param {string} roleId - The role ID
   * @param {string} roleName - The role name
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Object>} - Result with reset permissions count
   */
  resetRolePermissions: async (roleId, roleName, tenantId) => {
    try {
      logger.info('Resetting permissions for role', { roleId, roleName, tenantId });
      
      // Delete all existing permissions for this role
      await prisma.rolePermission.deleteMany({
        where: { roleId }
      });

      // Re-assign permissions based on matrix
      const result = await rolePermissionService.assignPermissionsToRole(roleId, roleName, tenantId);

      logger.info('Successfully reset role permissions', { roleId, roleName, result });
      return result;
    } catch (error) {
      logger.error('Error resetting role permissions', {
        roleId,
        roleName,
        tenantId,
        error: error.message
      });
      throw error;
    }
  },
};

module.exports = rolePermissionService; 