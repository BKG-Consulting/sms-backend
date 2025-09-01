const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger');

const userPermissionService = {
  /**
   * Grant a specific permission to a user
   * @param {string} userId - The user ID
   * @param {string} permissionId - The permission ID
   * @param {string} grantedBy - Who is granting this permission
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Created user permission
   */
  grantPermission: async (userId, permissionId, grantedBy, options = {}) => {
    try {
      const { expiresAt, reason } = options;
      
      const userPermission = await prisma.userPermission.upsert({
        where: {
          userId_permissionId: { userId, permissionId }
        },
        update: {
          allowed: true,
          grantedBy,
          grantedAt: new Date(),
          expiresAt,
          reason,
          updatedAt: new Date()
        },
        create: {
          userId,
          permissionId,
          allowed: true,
          grantedBy,
          expiresAt,
          reason
        }
      });

      logger.info('User permission granted', {
        userId,
        permissionId,
        grantedBy,
        reason
      });

      return userPermission;
    } catch (error) {
      logger.error('Error granting user permission', {
        userId,
        permissionId,
        grantedBy,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Revoke a specific permission from a user
   * @param {string} userId - The user ID
   * @param {string} permissionId - The permission ID
   * @param {string} revokedBy - Who is revoking this permission
   * @param {string} reason - Reason for revocation
   * @returns {Promise<Object>} - Updated user permission
   */
  revokePermission: async (userId, permissionId, revokedBy, reason = null) => {
    try {
      const userPermission = await prisma.userPermission.upsert({
        where: {
          userId_permissionId: { userId, permissionId }
        },
        update: {
          allowed: false,
          grantedBy: revokedBy,
          grantedAt: new Date(),
          reason: reason || 'Permission revoked',
          updatedAt: new Date()
        },
        create: {
          userId,
          permissionId,
          allowed: false,
          grantedBy: revokedBy,
          reason: reason || 'Permission revoked'
        }
      });

      logger.info('User permission revoked', {
        userId,
        permissionId,
        revokedBy,
        reason
      });

      return userPermission;
    } catch (error) {
      logger.error('Error revoking user permission', {
        userId,
        permissionId,
        revokedBy,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Remove a user permission entirely
   * @param {string} userId - The user ID
   * @param {string} permissionId - The permission ID
   * @returns {Promise<Object>} - Deletion result
   */
  removePermission: async (userId, permissionId) => {
    try {
      const result = await prisma.userPermission.delete({
        where: {
          userId_permissionId: { userId, permissionId }
        }
      });

      logger.info('User permission removed', {
        userId,
        permissionId
      });

      return result;
    } catch (error) {
      logger.error('Error removing user permission', {
        userId,
        permissionId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Get all permissions for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} - Array of user permissions
   */
  getUserPermissions: async (userId) => {
    try {
      const userPermissions = await prisma.userPermission.findMany({
        where: { userId },
        include: {
          permission: true,
          grantedByUser: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        },
        orderBy: [
          { permission: { module: 'asc' } },
          { permission: { action: 'asc' } }
        ]
      });

      return userPermissions;
    } catch (error) {
      logger.error('Error fetching user permissions', {
        userId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Get all users with their permissions for a tenant
   * @param {string} tenantId - The tenant ID
   * @returns {Promise<Array>} - Array of users with their permissions
   */
  getTenantUserPermissions: async (tenantId) => {
    try {
      const users = await prisma.user.findMany({
        where: { tenantId },
        include: {
          userPermissions: {
            include: {
              permission: true,
              grantedByUser: {
                select: { id: true, firstName: true, lastName: true, email: true }
              }
            }
          },
          userRoles: {
            include: { role: true }
          }
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' }
        ]
      });

      return users;
    } catch (error) {
      logger.error('Error fetching tenant user permissions', {
        tenantId,
        error: error.message
      });
      throw error;
    }
  },

  /**
   * Batch update user permissions
   * @param {Array} updates - Array of permission updates
   * @returns {Promise<Object>} - Result with updated count
   */
  batchUpdatePermissions: async (updates) => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const results = [];
        for (const update of updates) {
          const { userId, permissionId, allowed, grantedBy, reason, expiresAt } = update;
          
          const userPermission = await tx.userPermission.upsert({
            where: {
              userId_permissionId: { userId, permissionId }
            },
            update: {
              allowed,
              grantedBy,
              grantedAt: new Date(),
              reason,
              expiresAt,
              updatedAt: new Date()
            },
            create: {
              userId,
              permissionId,
              allowed,
              grantedBy,
              reason,
              expiresAt
            }
          });
          results.push(userPermission);
        }
        return results;
      });

      logger.info('Batch updated user permissions', { updatedCount: result.length });
      return { updatedCount: result.length, results };
    } catch (error) {
      logger.error('Error batch updating user permissions', { error: error.message });
      throw error;
    }
  },

  /**
   * Check if a user has a specific permission (including user-specific overrides)
   * @param {string} userId - The user ID
   * @param {string} module - The module name
   * @param {string} action - The action name
   * @returns {Promise<boolean>} - Whether the user has the permission
   */
  hasPermission: async (userId, module, action) => {
    try {
      // First check user-specific permissions
      const userPermission = await prisma.userPermission.findFirst({
        where: {
          userId,
          permission: {
            module,
            action
          },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: { permission: true }
      });

      if (userPermission) {
        return userPermission.allowed;
      }

      // If no user-specific permission, check role-based permissions
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: { include: { role: true } },
          userDepartmentRoles: { include: { role: true } }
        }
      });

      if (!user) return false;

      const roleIds = [
        ...(user.userRoles?.map(ur => ur.roleId) || []),
        ...(user.userDepartmentRoles?.map(udr => udr.roleId) || [])
      ];

      if (roleIds.length === 0) return false;

      const rolePermission = await prisma.rolePermission.findFirst({
        where: {
          roleId: { in: roleIds },
          permission: {
            module,
            action
          },
          allowed: true
        }
      });

      return !!rolePermission;
    } catch (error) {
      logger.error('Error checking user permission', {
        userId,
        module,
        action,
        error: error.message
      });
      return false;
    }
  }
};

module.exports = userPermissionService; 