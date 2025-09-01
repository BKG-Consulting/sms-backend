// src/controllers/roleController.js
const { z } = require('zod');
const roleService = require('../services/roleService');
const { logger } = require('../utils/logger');

const roleController = {
  createRole: async (req, res, next) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        roleScope: z.enum(['tenant', 'department', 'hybrid']).optional(),
        loginDestination: z.string().optional(),
        defaultContext: z.string().optional(),
        isDefault: z.boolean().optional(),
        isRemovable: z.boolean().optional(),
        permissions: z.array(z.string()).optional(),
        isPredefinedRole: z.boolean().optional(),
        predefinedRoleName: z.string().optional()
      });

      const roleData = schema.parse(req.body);
      const tenantId = req.user.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          message: 'Tenant ID not found in user context',
          error: 'Missing tenant context'
        });
      }

      const role = await roleService.createOrUpdateRole({
        ...roleData,
        tenantId
      });

      logger.info('Role created successfully', {
        roleId: role.id,
        roleName: role.name,
        tenantId,
        permissionCount: roleData.permissions?.length || 0,
        isPredefinedRole: roleData.isPredefinedRole
      });

      res.status(201).json({
        message: 'Role created successfully',
        role,
        permissionCount: roleData.permissions?.length || 0
      });
    } catch (error) {
      next(error);
    }
  },

  updateRole: async (req, res, next) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        roleScope: z.enum(['tenant', 'department', 'hybrid']).optional(),
        loginDestination: z.string().optional(),
        defaultContext: z.string().optional(),
        isDefault: z.boolean().optional(),
        isRemovable: z.boolean().optional(),
        permissions: z.array(z.string()).optional(),
        isPredefinedRole: z.boolean().optional(),
        predefinedRoleName: z.string().optional()
      });

      const { id } = req.params;
      const updateData = schema.parse(req.body);
      const tenantId = req.user.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          message: 'Tenant ID not found in user context',
          error: 'Missing tenant context'
        });
      }

      const role = await roleService.createOrUpdateRole({
        id,
        ...updateData,
        tenantId
      });

      logger.info('Role updated successfully', {
        roleId: role.id,
        roleName: role.name,
        tenantId,
        permissionCount: updateData.permissions?.length || 0,
        isPredefinedRole: updateData.isPredefinedRole
      });

      res.json({
        message: 'Role updated successfully',
        role,
        permissionCount: updateData.permissions?.length || 0
      });
    } catch (error) {
      next(error);
    }
  },

  getRoles: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          message: 'Tenant ID not found in user context',
          error: 'Missing tenant context'
        });
      }

      logger.info('Fetching roles for tenant', { tenantId });

      const roles = await roleService.getRolesByTenant(tenantId);
      
      logger.info('Roles fetched successfully', { 
        tenantId, 
        roleCount: roles.length,
        roleNames: roles.map(r => r.name)
      });

      res.json({
        message: 'Roles retrieved successfully',
        roles
      });
    } catch (error) {
      logger.error('Error fetching roles for tenant', { 
        tenantId: req.user.tenantId, 
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  },

  getRole: async (req, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          message: 'Tenant ID not found in user context',
          error: 'Missing tenant context'
        });
      }

      const role = await roleService.getRoleById(id, tenantId);
      
      if (!role) {
        return res.status(404).json({
          message: 'Role not found'
        });
      }

      res.json({
        message: 'Role retrieved successfully',
        role
      });
    } catch (error) {
      next(error);
    }
  },

  deleteRole: async (req, res, next) => {
    try {
      const { id } = req.params;
      const tenantId = req.user.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          message: 'Tenant ID not found in user context',
          error: 'Missing tenant context'
        });
      }

      await roleService.deleteRole(id, tenantId);
      
      logger.info('Role deleted successfully', {
        roleId: id,
        tenantId
      });

      res.json({
        message: 'Role deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  getRoleWithPermissions: async (req, res, next) => {
    try {
      const { roleId } = req.params;
      const tenantId = req.user.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          message: 'Tenant ID not found in user context',
          error: 'Missing tenant context'
        });
      }

      const roleWithPermissions = await roleService.getRoleWithPermissions(roleId, tenantId);
      res.json({
        message: 'Role with permissions retrieved successfully',
        role: roleWithPermissions
      });
    } catch (error) {
      next(error);
    }
  },

  updateRolePermissions: async (req, res, next) => {
    try {
      const schema = z.object({
        permissionIds: z.array(z.string())
      });

      const { roleId } = req.params;
      const { permissionIds } = schema.parse(req.body);
      const tenantId = req.user.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          message: 'Tenant ID not found in user context',
          error: 'Missing tenant context'
        });
      }

      const result = await roleService.updateRolePermissions(roleId, permissionIds, tenantId);
      res.json({
        message: 'Role permissions updated successfully',
        result
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = roleController; 