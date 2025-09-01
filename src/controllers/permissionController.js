const { prisma } = require('../../prisma/client');
const { z } = require('zod');

const permissionSchema = z.object({
  module: z.string().min(1, 'Module is required'),
  action: z.string().min(1, 'Action is required'),
  description: z.string().min(1, 'Description is required'),
});

const permissionController = {
  // Get all permissions
  getPermissions: async (req, res, next) => {
    try {
      const { tenantId } = req.user;
      
      const permissions = await prisma.permission.findMany({
        orderBy: [
          { module: 'asc' },
          { action: 'asc' }
        ]
      });

      res.json({ 
        success: true, 
        permissions,
        count: permissions.length 
      });
    } catch (error) {
      next(error);
    }
  },

  // Get permission by ID
  getPermissionById: async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const permission = await prisma.permission.findUnique({
        where: { id }
      });

      if (!permission) {
        return res.status(404).json({ 
          success: false, 
          message: 'Permission not found' 
        });
      }

      res.json({ 
        success: true, 
        permission 
      });
    } catch (error) {
      next(error);
    }
  },

  // Create new permission
  createPermission: async (req, res, next) => {
    try {
      const { module, action, description } = permissionSchema.parse(req.body);
      
      // Check if permission already exists
      const existingPermission = await prisma.permission.findFirst({
        where: {
          module,
          action
        }
      });

      if (existingPermission) {
        return res.status(400).json({
          success: false,
          message: `Permission '${module}:${action}' already exists`
        });
      }

      const permission = await prisma.permission.create({
        data: {
          module,
          action,
          description
        }
      });

      console.log(`✅ Created new permission: ${module}:${action}`);

      res.status(201).json({
        success: true,
        message: 'Permission created successfully',
        permission
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors
        });
      }
      next(error);
    }
  },

  // Update permission
  updatePermission: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { module, action, description } = permissionSchema.parse(req.body);
      
      // Check if permission exists
      const existingPermission = await prisma.permission.findUnique({
        where: { id }
      });

      if (!existingPermission) {
        return res.status(404).json({
          success: false,
          message: 'Permission not found'
        });
      }

      // Check if new module:action combination already exists (excluding current permission)
      const duplicatePermission = await prisma.permission.findFirst({
        where: {
          module,
          action,
          id: { not: id }
        }
      });

      if (duplicatePermission) {
        return res.status(400).json({
          success: false,
          message: `Permission '${module}:${action}' already exists`
        });
      }

      const updatedPermission = await prisma.permission.update({
        where: { id },
        data: {
          module,
          action,
          description
        }
      });

      console.log(`✅ Updated permission: ${module}:${action}`);

      res.json({
        success: true,
        message: 'Permission updated successfully',
        permission: updatedPermission
      });
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.errors
        });
      }
      next(error);
    }
  },

  // Delete permission
  deletePermission: async (req, res, next) => {
    try {
      const { id } = req.params;
      
      // Check if permission exists
      const permission = await prisma.permission.findUnique({
        where: { id },
        include: {
          rolePermissions: {
            include: {
              role: true
            }
          }
        }
      });

      if (!permission) {
        return res.status(404).json({
          success: false,
          message: 'Permission not found'
        });
      }

      // Check if permission is being used by any roles
      if (permission.rolePermissions.length > 0) {
        const roleNames = permission.rolePermissions.map(rp => rp.role.name).join(', ');
        return res.status(400).json({
          success: false,
          message: `Cannot delete permission '${permission.module}:${permission.action}' as it is assigned to roles: ${roleNames}`
        });
      }

      await prisma.permission.delete({
        where: { id }
      });

      console.log(`✅ Deleted permission: ${permission.module}:${permission.action}`);

      res.json({
        success: true,
        message: 'Permission deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  // Get permissions by module
  getPermissionsByModule: async (req, res, next) => {
    try {
      const { module } = req.params;
      
      const permissions = await prisma.permission.findMany({
        where: { module },
        orderBy: { action: 'asc' }
      });

      res.json({
        success: true,
        permissions,
        count: permissions.length
      });
    } catch (error) {
      next(error);
    }
  },

  // Get permission categories
  getPermissionCategories: async (req, res, next) => {
    try {
      // Get all permissions grouped by module
      const permissions = await prisma.permission.findMany({
        orderBy: [
          { module: 'asc' },
          { action: 'asc' }
        ]
      });

      // Group permissions by module
      const moduleGroups = permissions.reduce((groups, permission) => {
        const module = permission.module;
        if (!groups[module]) {
          groups[module] = [];
        }
        groups[module].push(permission);
        return groups;
      }, {});

      // Convert to category format with nested permissions
      const categories = Object.entries(moduleGroups).map(([moduleName, modulePermissions]) => ({
        id: moduleName, // Use module name as ID
        name: moduleName,
        description: `${moduleName} related permissions`,
        permissions: modulePermissions,
        count: modulePermissions.length
      }));

      res.json({
        success: true,
        categories: categories
      });
    } catch (error) {
      next(error);
    }
  },

  // Check if user has a specific permission
  checkPermission: async (req, res, next) => {
    try {
      const { module, action } = req.body;
      const userId = req.user.userId;
      
      if (!module || !action) {
        return res.status(400).json({
          success: false,
          message: 'Module and action are required'
        });
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Use the existing permission utility to check permission
      const { hasPermission } = require('../utils/permissionUtils');
      
      const hasAccess = await hasPermission(req.user, `${module}:${action}`);
      
      console.log(`Permission check for user ${userId}: ${module}:${action} = ${hasAccess}`);

      res.json({
        success: true,
        hasPermission: hasAccess,
        message: hasAccess ? 'Permission granted' : 'Permission denied'
      });
    } catch (error) {
      console.error('Error checking permission:', error);
      next(error);
    }
  }
};

module.exports = permissionController; 