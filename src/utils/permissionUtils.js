// Permission check utility for RBAC
const { prisma } = require('../../prisma/client');
const { logger } = require('./logger');

/**
 * Checks if a user has a given permission (module:action) via all their roles.
 * Aggregates all user roles (userRoles, roles, userDepartmentRoles, defaultRole, primaryRole).
 * Logs detailed info for debugging.
 */
// Utility to normalize module names to camelCase for permission checks
function normalizeModuleName(module) {
  // Convert kebab-case or snake_case to camelCase
  return module.replace(/[-_](.)/g, (_, c) => c.toUpperCase());
}

async function hasPermission(user, permissionString) {
  // Parse permission string (e.g., "auditProgram:create")
  const [module, action] = permissionString.split(':');
  const userId = user.id || user.userId;
  
  logger.debug('[PERMISSION] Checking', { 
    userId, 
    module, 
    action, 
    permissionString,
    tenantId: user.tenantId,
    userRoles: user.userRoles?.map(ur => ({ id: ur.roleId, name: ur.role?.name })),
    defaultRole: user.defaultRole,
    primaryRole: user.primaryRole
  });

  if (!userId) {
    logger.warn('[PERMISSION] No userId found in user object', { user });
    return false;
  }
  
  // Normalize module name to match seeded permissions
  const normalizedModule = normalizeModuleName(module);
  logger.debug('[PERMISSION] Normalized module', { original: module, normalized: normalizedModule });
  
  // 1. Check user-specific permissions FIRST (these override role permissions)
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userPermissions: { 
        include: { permission: true },
        where: {
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      },
    },
  });
  
  if (!userData) {
    logger.warn('[PERMISSION] User not found', { userId });
    return false;
  }
  
  // Check user-specific permissions
  const userPermission = userData.userPermissions?.find(up => 
    up.permission.module === normalizedModule && 
    up.permission.action === action && 
    up.allowed === true
  );
  
  if (userPermission) {
    logger.debug('[PERMISSION] User-specific permission found', { 
      permissionId: userPermission.permissionId,
      grantedBy: userPermission.grantedBy,
      reason: userPermission.reason
    });
    return true; // User-specific permission overrides everything
  }
  
  // Check for explicit denial via user-specific permission
  const userDenial = userData.userPermissions?.find(up => 
    up.permission.module === normalizedModule && 
    up.permission.action === action && 
    up.allowed === false
  );
  
  if (userDenial) {
    logger.debug('[PERMISSION] User-specific permission denied', { 
      permissionId: userDenial.permissionId,
      grantedBy: userDenial.grantedBy,
      reason: userDenial.reason
    });
    return false; // Explicit denial overrides role permissions
  }
  
  // 2. Get role IDs from JWT token (these are the current, valid roles)
  const roleIds = [];
  
  // Add userRoles from JWT (these are the main roles)
  if (user.userRoles && Array.isArray(user.userRoles)) {
    user.userRoles.forEach(userRole => {
      if (userRole.id) {
        roleIds.push(userRole.id);
      } else if (userRole.roleId) {
        roleIds.push(userRole.roleId);
      }
    });
  }
  
  // Add defaultRole from JWT if it exists
  if (user.defaultRole?.id) {
    roleIds.push(user.defaultRole.id);
  }
  
  // Add primaryRole from JWT if it exists
  if (user.primaryRole?.id) {
    roleIds.push(user.primaryRole.id);
  }
  
  // Remove duplicates
  const uniqueRoleIds = [...new Set(roleIds)];
  
  logger.debug('[PERMISSION] Role IDs from JWT', { 
    roleIds: uniqueRoleIds,
    tenantId: user.tenantId
  });
  
  if (uniqueRoleIds.length === 0) {
    logger.warn('[PERMISSION] No roles found for user', { userId });
    return false;
  }
  
  // 3. Find the permission for the normalized module/action
  const permission = await prisma.permission.findFirst({
    where: { module: normalizedModule, action },
  });
  if (!permission) {
    logger.warn('[PERMISSION] Permission not found', { module: normalizedModule, action });
    return false;
  }
  logger.debug('[PERMISSION] Permission found', { permissionId: permission.id });
  
  // 4. Check if any of the user's roles have this permission allowed
  // Only check roles within the user's tenant
  const rolePermission = await prisma.rolePermission.findFirst({
    where: {
      roleId: { in: uniqueRoleIds },
      permissionId: permission.id,
      allowed: true,
      role: {
        tenantId: user.tenantId // Ensure tenant scoping
      }
    },
    include: {
      role: true
    }
  });
  
  logger.debug('[PERMISSION] RolePermission found', { 
    result: !!rolePermission,
    roleId: rolePermission?.roleId,
    roleName: rolePermission?.role?.name,
    tenantId: rolePermission?.role?.tenantId
  });
  
  return !!rolePermission;
}

module.exports = { hasPermission }; 