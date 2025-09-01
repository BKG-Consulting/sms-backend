const { z } = require('zod');
const userPermissionService = require('../services/userPermissionService');
const { logger } = require('../utils/logger');

const userPermissionController = {
  /**
   * Grant a permission to a user
   */
  grantPermission: async (req, res, next) => {
    try {
      const schema = z.object({
        userId: z.string(),
        permissionId: z.string(),
        reason: z.string().optional(),
        expiresAt: z.string().optional().transform(val => val ? new Date(val) : null)
      });

      const { userId, permissionId, reason, expiresAt } = schema.parse(req.body);
      const grantedBy = req.user.userId;

      const userPermission = await userPermissionService.grantPermission(
        userId, 
        permissionId, 
        grantedBy, 
        { reason, expiresAt }
      );

      logger.info('Permission granted via API', { userId, permissionId, grantedBy });
      
      res.status(201).json({
        message: 'Permission granted successfully',
        userPermission
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Revoke a permission from a user
   */
  revokePermission: async (req, res, next) => {
    try {
      const schema = z.object({
        userId: z.string(),
        permissionId: z.string(),
        reason: z.string().optional()
      });

      const { userId, permissionId, reason } = schema.parse(req.body);
      const revokedBy = req.user.userId;

      const userPermission = await userPermissionService.revokePermission(
        userId, 
        permissionId, 
        revokedBy, 
        reason
      );

      logger.info('Permission revoked via API', { userId, permissionId, revokedBy });
      
      res.json({
        message: 'Permission revoked successfully',
        userPermission
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Remove a user permission entirely
   */
  removePermission: async (req, res, next) => {
    try {
      const schema = z.object({
        userId: z.string(),
        permissionId: z.string()
      });

      const { userId, permissionId } = schema.parse(req.params);

      await userPermissionService.removePermission(userId, permissionId);

      logger.info('Permission removed via API', { userId, permissionId });
      
      res.json({
        message: 'Permission removed successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get all permissions for a specific user
   */
  getUserPermissions: async (req, res, next) => {
    try {
      const schema = z.object({
        userId: z.string()
      });

      const { userId } = schema.parse(req.params);

      const userPermissions = await userPermissionService.getUserPermissions(userId);

      res.json({
        message: 'User permissions retrieved successfully',
        userPermissions,
        count: userPermissions.length
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get all users with their permissions for the current tenant
   */
  getTenantUserPermissions: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          message: 'Tenant ID not found in user context',
          error: 'Missing tenant context'
        });
      }

      const users = await userPermissionService.getTenantUserPermissions(tenantId);

      res.json({
        message: 'Tenant user permissions retrieved successfully',
        users,
        count: users.length
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Batch update user permissions
   */
  batchUpdatePermissions: async (req, res, next) => {
    try {
      const schema = z.object({
        updates: z.array(z.object({
          userId: z.string(),
          permissionId: z.string(),
          allowed: z.boolean(),
          reason: z.string().optional(),
          expiresAt: z.string().optional().transform(val => val ? new Date(val) : null)
        }))
      });

      const { updates } = schema.parse(req.body);
      const grantedBy = req.user.userId;

      // Add grantedBy to all updates
      const updatesWithGrantedBy = updates.map(update => ({
        ...update,
        grantedBy
      }));

      const result = await userPermissionService.batchUpdatePermissions(updatesWithGrantedBy);

      logger.info('Batch permissions updated via API', { 
        updatedCount: result.updatedCount, 
        grantedBy 
      });
      
      res.json({
        message: 'Permissions updated successfully',
        result
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Check if a user has a specific permission
   */
  checkPermission: async (req, res, next) => {
    try {
      const schema = z.object({
        userId: z.string(),
        module: z.string(),
        action: z.string()
      });

      const { userId, module, action } = schema.parse(req.params);

      const hasPermission = await userPermissionService.hasPermission(userId, module, action);

      res.json({
        message: 'Permission check completed',
        hasPermission,
        userId,
        module,
        action
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = userPermissionController; 