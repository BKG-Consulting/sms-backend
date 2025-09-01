const roleRepository = require('../repositories/roleRepository');
const userRepository = require('../repositories/userRepository');
const rolePermissionService = require('./rolePermissionService');
const { getAvailableRoles, getRoleDescription } = require('../../constants/rolePermissions');
const { logger } = require('../utils/logger');
const { Prisma } = require('@prisma/client');

const roleService = {
  createOrUpdateRole: async ({ id, name, description, tenantId, loginDestination, defaultContext, isDefault, isRemovable, permissions, isPredefinedRole, predefinedRoleName, roleScope, customizePredefinedRole }) => {
    try {
      let role;
      
      if (id) {
        const existingRole = await roleRepository.findRoleById(id);
        if (existingRole) {
          role = await roleRepository.updateRole(id, { 
            name, 
            description, 
            tenantId, 
            loginDestination, 
            defaultContext, 
            isDefault, 
            isRemovable,
            roleScope: roleScope || 'tenant'
          });
          
          // Handle permission assignment for updates
          if (permissions && Array.isArray(permissions)) {
            await rolePermissionService.assignSpecificPermissionsToRole(role.id, permissions, tenantId);
            logger.info('Updated role permissions', { roleId: role.id, roleName: name, permissionCount: permissions.length });
          } else if (isPredefinedRole && predefinedRoleName && !customizePredefinedRole) {
            // Auto-assign permissions if this is a predefined role and not customized
            await rolePermissionService.assignPermissionsToRole(role.id, predefinedRoleName, tenantId);
            logger.info('Auto-assigned predefined permissions to updated role', { roleId: role.id, roleName: name });
          }
          
          return role;
        }
      }
      
      // Create new role with role scope
      role = await roleRepository.createRole({ 
        name, 
        description, 
        tenantId, 
        loginDestination, 
        defaultContext, 
        isDefault, 
        isRemovable,
        roleScope: roleScope || 'tenant'
      });
      
      // Handle permission assignment for new roles
      if (permissions && Array.isArray(permissions)) {
        // Assign specific permissions provided by user
        await rolePermissionService.assignSpecificPermissionsToRole(role.id, permissions, tenantId);
        logger.info('Assigned specific permissions to new role', { 
          roleId: role.id, 
          roleName: name, 
          permissionCount: permissions.length,
          roleScope: roleScope
        });
      } else if (isPredefinedRole && predefinedRoleName && !customizePredefinedRole) {
        // Auto-assign permissions if this is a predefined role and not customized
        const permResult = await rolePermissionService.assignPermissionsToRole(role.id, predefinedRoleName, tenantId);
        logger.info('Auto-assigned predefined permissions to new role', { 
          roleId: role.id, 
          roleName: name, 
          assignedCount: permResult.assignedCount,
          roleScope: roleScope
        });
      } else if (getAvailableRoles().includes(name.toUpperCase())) {
        // Fallback: Auto-assign permissions if this is a predefined role (by name)
        try {
          const permResult = await rolePermissionService.assignPermissionsToRole(role.id, name, tenantId);
          logger.info('Auto-assigned permissions to new role (by name)', { 
            roleId: role.id, 
            roleName: name, 
            assignedCount: permResult.assignedCount,
            roleScope: roleScope
          });
        } catch (permError) {
          logger.warn('Failed to auto-assign permissions to new role (by name)', { 
            roleId: role.id, 
            roleName: name, 
            error: permError.message 
          });
        }
      } else {
        logger.info('Created new role without permissions - will need manual assignment', { 
          roleId: role.id, 
          roleName: name,
          roleScope: roleScope
        });
      }
      
      return role;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicateField = error.meta && error.meta.target ? error.meta.target.join(', ') : 'name';
        const message = duplicateField.includes('name')
          ? 'A role with this name already exists for this institution.'
          : 'Duplicate value for unique field(s): ' + duplicateField;
        const err = new Error(message);
        err.status = 409;
        throw err;
      }
      logger.error('Error in createOrUpdateRole', { error: error.message, name, tenantId });
      throw error;
    }
  },

  getRoleById: async (id, tenantId) => {
    const role = await roleRepository.findRoleById(id, tenantId);
    if (!role) {
      throw new Error('Role not found');
    }
    return role;
  },

  getAllRoles: async () => {
    return roleRepository.findAllRoles();
  },

  getRolesByTenant: async (tenantId) => {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    
    logger.info('Getting roles by tenant', { tenantId });
    
    try {
      const roles = await roleRepository.findRolesByTenant(tenantId);
      logger.info('Roles retrieved from repository', { 
        tenantId, 
        roleCount: roles.length,
        roleNames: roles.map(r => r.name)
      });
      return roles;
    } catch (error) {
      logger.error('Error getting roles by tenant', { 
        tenantId, 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  },

  assignRoles: async (email, roleIds) => {
    const user = await userRepository.findUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    const roles = await roleRepository.findRolesByIds(roleIds);
    if (roles.length !== roleIds.length) {
      throw new Error('One or more role IDs are invalid');
    }
    await roleRepository.assignRolesToUser(user.id, roleIds);
    return roles.map((role) => ({ id: role.id, name: role.name }));
  },

  deleteRole: async (id, tenantId) => {
    const role = await roleRepository.findRoleById(id);
    if (!role) {
      throw new Error('Role not found');
    }
    if (role.tenantId !== tenantId) {
      throw new Error('Not authorized to delete this role');
    }
    
    // Delete role permissions first
    try {
      await rolePermissionService.deleteRolePermissions(id);
    } catch (error) {
      logger.warn('Failed to delete role permissions', { roleId: id, error: error.message });
    }
    
    await roleRepository.deleteRole(id);
    return true;
  },

  // Get available predefined roles
  getAvailableRoles: () => {
    return getAvailableRoles();
  },

  // Get role description
  getRoleDescription: (roleName) => {
    return getRoleDescription(roleName);
  },

  // Reset role permissions to default
  resetRolePermissions: async (roleId, roleName, tenantId) => {
    return await rolePermissionService.resetRolePermissions(roleId, roleName, tenantId);
  },

  // Get role with permissions
  getRoleWithPermissions: async (roleId, tenantId) => {
    try {
      const role = await roleRepository.findRoleById(roleId, tenantId);
      if (!role) {
        throw new Error('Role not found');
      }

      const rolePermissions = await rolePermissionService.getRolePermissions(roleId);
      
      return {
        ...role,
        permissions: rolePermissions.map(rp => ({
          id: rp.permission.id,
          module: rp.permission.module,
          action: rp.permission.action,
          description: rp.permission.description,
          allowed: rp.allowed
        }))
      };
    } catch (error) {
      logger.error('Error getting role with permissions', { roleId, error: error.message });
      throw error;
    }
  },

  // Update role permissions
  updateRolePermissions: async (roleId, permissionIds, tenantId) => {
    try {
      await rolePermissionService.assignSpecificPermissionsToRole(roleId, permissionIds, tenantId);
      logger.info('Updated role permissions', { roleId, permissionCount: permissionIds.length });
      return { success: true, updatedCount: permissionIds.length };
    } catch (error) {
      logger.error('Error updating role permissions', { roleId, error: error.message });
      throw error;
    }
  },

  // Get roles by scope for better user assignment
  getRolesByScope: async (tenantId, scope = null) => {
    try {
      const whereClause = { tenantId };
      if (scope) {
        whereClause.roleScope = scope;
      }
      
      const roles = await roleRepository.findRolesByTenant(tenantId);
      
      // Filter by scope if specified
      if (scope) {
        return roles.filter(role => role.roleScope === scope);
      }
      
      return roles;
    } catch (error) {
      logger.error('Error getting roles by scope', { tenantId, scope, error: error.message });
      throw error;
    }
  },

  // Get user's effective permissions from all roles
  getUserEffectivePermissions: async (userId, tenantId) => {
    try {
      // Get all user roles (both tenant-wide and department-specific)
      const userRoles = await userRepository.getUserRoles(userId);
      const userDepartmentRoles = await userRepository.getUserDepartmentRoles(userId);
      
      const allRoleIds = [
        ...userRoles.map(ur => ur.roleId),
        ...userDepartmentRoles.map(udr => udr.roleId)
      ];
      
      if (allRoleIds.length === 0) {
        return [];
      }
      
      // Get all permissions for these roles
      const rolePermissions = await rolePermissionService.getRolePermissionsForRoles(allRoleIds);
      
      // Deduplicate permissions (user might have same permission from multiple roles)
      const uniquePermissions = new Map();
      rolePermissions.forEach(rp => {
        const key = `${rp.permission.module}:${rp.permission.action}`;
        if (rp.allowed && !uniquePermissions.has(key)) {
          uniquePermissions.set(key, {
            id: rp.permission.id,
            module: rp.permission.module,
            action: rp.permission.action,
            description: rp.permission.description
          });
        }
      });
      
      return Array.from(uniquePermissions.values());
    } catch (error) {
      logger.error('Error getting user effective permissions', { userId, tenantId, error: error.message });
      throw error;
    }
  }
};

module.exports = roleService;