const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger.util');
const { AppError } = require('../../errors/app.error');

// Get all roles for the tenant
const getRoles = async (req, res, next) => {
    try {
    const tenantId = req.user.tenantId;

      if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
      }

      const roles = await prisma.role.findMany({
        where: { tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        isRemovable: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { name: 'asc' }
    });

    logger.info('Roles fetched for permission matrix', {
      tenantId,
      count: roles.length
    });

    res.json({
      message: 'Roles fetched successfully',
      roles
    });
  } catch (error) {
    next(error);
  }
};

// Get all permissions (optionally filtered by module)
const getPermissions = async (req, res, next) => {
  try {
    const { module } = req.query;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const whereClause = {};
    if (module) {
      whereClause.module = module;
    }

    const permissions = await prisma.permission.findMany({
      where: whereClause,
      select: {
        id: true,
        module: true,
        action: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [
        { module: 'asc' },
        { action: 'asc' }
      ]
    });

    logger.info('Permissions fetched for permission matrix', {
      tenantId,
      module,
      count: permissions.length
    });

    res.json({
      message: 'Permissions fetched successfully',
      permissions
    });
  } catch (error) {
    next(error);
  }
};

// Get role permissions matrix
const getRolePermissions = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role: {
          tenantId
        }
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            tenantId: true
          }
        },
        permission: {
          select: {
            id: true,
            module: true,
            action: true
          }
        }
      },
      orderBy: [
        { role: { name: 'asc' } },
        { permission: { module: 'asc' } },
        { permission: { action: 'asc' } }
      ]
    });

    logger.info('Role permissions matrix fetched', {
      tenantId,
      count: rolePermissions.length
    });

    res.json({
      message: 'Role permissions matrix fetched successfully',
      rolePermissions
    });
  } catch (error) {
    next(error);
  }
};

// Update a single role permission
const updateRolePermission = async (req, res, next) => {
  try {
    const { roleId, permissionId } = req.params;
    const { allowed } = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    // Verify role belongs to tenant
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId
      }
    });

    if (!role) {
      return res.status(404).json({
        message: 'Role not found',
        error: 'ROLE_NOT_FOUND'
      });
    }

    // Verify permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId }
    });

    if (!permission) {
      return res.status(404).json({
        message: 'Permission not found',
        error: 'PERMISSION_NOT_FOUND'
      });
    }

    // Update or create role permission
    const rolePermission = await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId
        }
      },
      update: {
        allowed,
        updatedAt: new Date()
      },
      create: {
        roleId,
        permissionId,
        allowed,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        role: {
          select: {
            id: true,
            name: true
          }
        },
        permission: {
          select: {
            id: true,
            module: true,
            action: true
          }
        }
      }
    });

    logger.info('Role permission updated', {
      tenantId,
      roleId,
      permissionId,
      allowed,
      updatedBy
    });

    res.json({
      message: 'Role permission updated successfully',
      rolePermission
    });
  } catch (error) {
    next(error);
  }
};

// Batch update role permissions
const batchUpdateRolePermissions = async (req, res, next) => {
  try {
    const { changes } = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }
      
      if (!Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({
        message: 'No changes provided',
        error: 'NO_CHANGES'
      });
    }

    // Validate all roles belong to tenant
    const roleIds = [...new Set(changes.map(c => c.roleId))];
    const roles = await prisma.role.findMany({
      where: {
        id: { in: roleIds },
        tenantId
      },
      select: { id: true }
    });

    if (roles.length !== roleIds.length) {
      return res.status(400).json({
        message: 'Some roles do not belong to this tenant',
        error: 'INVALID_ROLES'
      });
    }

    // Validate all permissions exist
    const permissionIds = [...new Set(changes.map(c => c.permissionId))];
    const permissions = await prisma.permission.findMany({
      where: {
        id: { in: permissionIds }
      },
      select: { id: true }
    });

    if (permissions.length !== permissionIds.length) {
      return res.status(400).json({
        message: 'Some permissions do not exist',
        error: 'INVALID_PERMISSIONS'
      });
    }

    // Process changes in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updates = [];

      for (const change of changes) {
        const { roleId, permissionId, allowed } = change;

        const rolePermission = await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId,
              permissionId
            }
          },
          update: {
            allowed,
            updatedAt: new Date()
          },
          create: {
            roleId,
            permissionId,
            allowed,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });

        updates.push(rolePermission);
      }

      return updates;
    });

    logger.info('Batch role permissions updated', {
      tenantId,
      changesCount: changes.length,
      updatedBy
    });

    res.json({
      message: `Successfully updated ${result.length} role permissions`,
      updatedCount: result.length,
      changes
    });
  } catch (error) {
    next(error);
  }
};

// Get permissions for a specific module
const getPermissionsByModule = async (req, res, next) => {
  try {
    const { module } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const permissions = await prisma.permission.findMany({
      where: { module },
      select: {
        id: true,
        module: true,
        action: true,
        description: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { action: 'asc' }
    });

    logger.info('Module permissions fetched', {
      tenantId,
      module,
      count: permissions.length
    });

    res.json({
      message: 'Module permissions fetched successfully',
      permissions
    });
    } catch (error) {
    next(error);
  }
};

// Get role permissions for a specific module
const getRolePermissionsByModule = async (req, res, next) => {
  try {
    const { module } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role: {
          tenantId
        },
        permission: {
          module
        }
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            tenantId: true
          }
        },
        permission: {
          select: {
            id: true,
            module: true,
            action: true
          }
        }
      },
      orderBy: [
        { role: { name: 'asc' } },
        { permission: { action: 'asc' } }
      ]
    });

    logger.info('Module role permissions fetched', {
      tenantId,
      module,
      count: rolePermissions.length
    });

    res.json({
      message: 'Module role permissions fetched successfully',
      rolePermissions
    });
  } catch (error) {
    next(error);
  }
};

// Get permissions for a specific role
const getRolePermissionsForRole = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    // Verify the role belongs to the tenant
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId: tenantId
      }
    });

    if (!role) {
      return res.status(404).json({
        message: 'Role not found',
        error: 'Role does not exist or does not belong to this tenant'
      });
    }

    // Get role permissions
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        roleId: roleId
      },
      include: {
        permission: true
      }
    });

    logger.info('Role permissions fetched', {
      roleId,
      tenantId,
      count: rolePermissions.length
    });

    res.json(rolePermissions);
  } catch (error) {
    logger.error('Error fetching role permissions:', error);
    next(error);
  }
};

// Update permissions for a specific role
const updateRolePermissionsForRole = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const { permissions } = req.body;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        message: 'Permissions array is required',
        error: 'Invalid permissions data'
      });
    }

    // Verify the role belongs to the tenant
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId: tenantId
      }
    });

    if (!role) {
      return res.status(404).json({
        message: 'Role not found',
        error: 'Role does not exist or does not belong to this tenant'
      });
    }

    // Use transaction to update permissions
    await prisma.$transaction(async (tx) => {
      // Delete existing permissions for this role
      await tx.rolePermission.deleteMany({
        where: {
          roleId: roleId
        }
      });

      // Create new permissions
      const permissionData = permissions
        .filter(p => p.allowed)
        .map(p => ({
          roleId: roleId,
          permissionId: p.permissionId,
          allowed: true
        }));

      if (permissionData.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionData
        });
      }
    });

    logger.info('Role permissions updated', {
      roleId,
      tenantId,
      permissionsCount: permissions.filter(p => p.allowed).length
    });

    res.json({
      message: 'Role permissions updated successfully'
    });
  } catch (error) {
    logger.error('Error updating role permissions:', error);
    next(error);
  }
};

// Assign permissions to a role
const assignPermissionsToRole = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    if (!permissionIds || !Array.isArray(permissionIds)) {
      return res.status(400).json({
        message: 'Permission IDs array is required',
        error: 'Invalid permission IDs'
      });
    }

    // Verify the role belongs to the tenant
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId: tenantId
      }
    });

    if (!role) {
      return res.status(404).json({
        message: 'Role not found',
        error: 'Role does not exist or does not belong to this tenant'
      });
    }

    // Create role permissions
    const permissionData = permissionIds.map(permissionId => ({
      roleId: roleId,
      permissionId: permissionId,
      allowed: true
    }));

    await prisma.rolePermission.createMany({
      data: permissionData,
      skipDuplicates: true
    });

    logger.info('Permissions assigned to role', {
      roleId,
      tenantId,
      permissionCount: permissionIds.length
    });

    res.json({
      message: 'Permissions assigned successfully'
    });
  } catch (error) {
    logger.error('Error assigning permissions to role:', error);
    next(error);
  }
};

// Remove permissions from a role
const removePermissionsFromRole = async (req, res, next) => {
  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    if (!permissionIds || !Array.isArray(permissionIds)) {
      return res.status(400).json({
        message: 'Permission IDs array is required',
        error: 'Invalid permission IDs'
      });
    }

    // Verify the role belongs to the tenant
    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        tenantId: tenantId
      }
    });

    if (!role) {
      return res.status(404).json({
        message: 'Role not found',
        error: 'Role does not exist or does not belong to this tenant'
      });
    }

    // Remove role permissions
    await prisma.rolePermission.deleteMany({
      where: {
        roleId: roleId,
        permissionId: {
          in: permissionIds
        }
      }
    });

    logger.info('Permissions removed from role', {
      roleId,
      tenantId,
      permissionCount: permissionIds.length
    });

    res.json({
      message: 'Permissions removed successfully'
    });
  } catch (error) {
    logger.error('Error removing permissions from role:', error);
    next(error);
  }
};

const getPermissionsForRoles = async (req, res, next) => {
  try {
    const { roleIds, tenantId } = req.body;
    
    if (!roleIds || !Array.isArray(roleIds) || roleIds.length === 0) {
      throw new AppError('Role IDs array is required', 400);
    }

    if (!tenantId) {
      throw new AppError('Tenant ID is required', 400);
    }

    // Fetch permissions for all specified roles
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        roleId: { in: roleIds },
        role: {
          tenantId: tenantId
        }
      },
      include: {
        permission: true,
        role: {
          select: {
            id: true,
            name: true,
            roleScope: true
          }
        }
      }
    });

    // Extract unique permissions
    const permissions = [];
    const permissionIds = new Set();
    
    rolePermissions.forEach(rp => {
      if (rp.permission && !permissionIds.has(rp.permission.id)) {
        permissions.push(rp.permission);
        permissionIds.add(rp.permission.id);
      }
    });

    logger.info('Fetched permissions for roles', {
      roleIds,
      tenantId,
      permissionCount: permissions.length,
      rolePermissionCount: rolePermissions.length
    });

    res.json({
      success: true,
      permissions,
      rolePermissions
    });
  } catch (error) {
    logger.error('Error fetching permissions for roles:', error);
    next(error);
  }
};

module.exports = {
  getRoles,
  getPermissions,
  getRolePermissions,
  updateRolePermission,
  batchUpdateRolePermissions,
  getPermissionsByModule,
  getRolePermissionsByModule,
  getPermissionsForRoles,
  getRolePermissionsForRole,
  updateRolePermissionsForRole,
  assignPermissionsToRole,
  removePermissionsFromRole
}; 