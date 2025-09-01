// src/controllers/userController.js
const { z } = require('zod');
const userService = require('../services/userService');
const { logger } = require('../utils/logger');

const userIdSchema = z.object({
  id: z.string(),
});

const deleteAccountSchema = z.object({
  userId: z.string(),
});

const usersByRoleTenantSchema = z.object({
  roleId: z.string(),
  tenantId: z.string(),
});

const getAllUsersSchema = z.object({
  page: z.string().optional().transform(val => parseInt(val) || 1),
  limit: z.string().optional().transform(val => parseInt(val) || 10),
  search: z.string().optional(),
  tenantId: z.string().optional(),
  departmentId: z.string().optional(),
  roleId: z.string().optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().optional(),
  // Legacy fields for backward compatibility
  departmentId: z.string().optional(),
  roleIds: z.array(z.string()).optional(),
  defaultRoleId: z.string().optional(),
  campusId: z.string().optional(),
  // New multi-department, multi-role structure
  departmentAssignments: z.array(z.object({
    departmentId: z.string().uuid(),
    roleId: z.string().uuid(),
    isPrimary: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })).optional(),
  systemRoles: z.array(z.object({
    roleId: z.string().uuid(),
    isDefault: z.boolean().optional(),
  })).optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  roleIds: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  }),
});

const setDefaultRoleSchema = z.object({
  userId: z.string().uuid().optional(),
  roleId: z.string().uuid(),
  type: z.enum(['userRole', 'userDepartmentRole'])
});

const comprehensiveUpdateSchema = z.object({
  basicInfo: z.object({
    email: z.string().email().optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    verified: z.boolean().optional(),
  }).optional(),
  roleUpdates: z.object({
    addRoles: z.array(z.object({
      roleId: z.string().uuid(),
      isDefault: z.boolean().optional(),
    })).optional(),
    removeRoles: z.array(z.string().uuid()).optional(),
    setDefaultRole: z.string().uuid().optional(),
  }).optional(),
  departmentUpdates: z.object({
    addDepartments: z.array(z.object({
      departmentId: z.string().uuid(),
      roleId: z.string().uuid(),
      isPrimary: z.boolean().optional(),
      isDefault: z.boolean().optional(),
    })).optional(),
    removeDepartments: z.array(z.string().uuid()).optional(),
    setPrimaryDepartment: z.string().uuid().optional(),
  }).optional(),
});

const userController = {
  createUser: async (req, res, next) => {
    try {
      const userData = createUserSchema.parse(req.body);
      const tenantId = req.user.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          message: 'Tenant ID not found in user context',
          error: 'Missing tenant context'
        });
      }

      const user = await userService.createUser({
        ...userData,
        tenantId,
        createdBy: req.user.userId
      });

      logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
        tenantId,
        createdBy: req.user.userId
      });

      res.status(201).json({
        message: 'User created successfully',
        user
      });
    } catch (error) {
      next(error);
    }
  },

  me: async (req, res, next) => {
    try {
      const user = await userService.getCurrentUser(req.user.userId);
      logger.info('User details fetched', { userId: user.id });
      res.json(user);
    } catch (error) {
      next(error);
    }
  },

  getUserById: async (req, res, next) => {
    try {
      const { id } = userIdSchema.parse(req.params);
      const user = await userService.getUserById(id);
      logger.info('User fetched by ID', { userId: id });
      res.json(user);
    } catch (error) {
      next(error);
    }
  },

  deleteAccount: async (req, res, next) => {
    try {
      const { userId } = deleteAccountSchema.parse(req.body);
      await userService.deleteAccount(userId);
      logger.info('Account deleted successfully', { userId });
      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  },

  getUsersByRoleAndTenant: async (req, res, next) => {
    try {
      const { roleId, tenantId } = usersByRoleTenantSchema.parse(req.query);
      const users = await userService.getUsersByRoleAndTenant(roleId, tenantId);
      logger.info('Users fetched by role and tenant', { roleId, tenantId, userCount: users.length });
      res.json(users);
    } catch (error) {
      next(error);
    }
  },

  // New method to fetch HODs for document ownership selection
  getHODs: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const hods = await userService.getHODs(tenantId);
      logger.info('HODs fetched for document ownership', { tenantId, hodCount: hods.length });
      res.json({ hods });
    } catch (error) {
      next(error);
    }
  },

  // New method to fetch all department heads (HODs and HOD AUDITORs) for document ownership selection
  getDepartmentHeads: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const departmentHeads = await userService.getDepartmentHeads(tenantId);
      logger.info('Department heads fetched for document ownership', { tenantId, headCount: departmentHeads.length });
      res.json({ departmentHeads });
    } catch (error) {
      next(error);
    }
  },

  getAllUsers: async (req, res, next) => {
    try {
      const { page, limit, search, tenantId, departmentId, roleId } = getAllUsersSchema.parse(req.query);
      const result = await userService.getAllUsers({ page, limit, search, tenantId, departmentId, roleId });
      logger.info('All users fetched by super admin', { page, limit, search, userCount: result.users.length });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  updateUser: async (req, res, next) => {
    try {
      const { id } = userIdSchema.parse(req.params);
      const updateData = updateUserSchema.parse(req.body);
      const updatedUser = await userService.updateUser(id, updateData);
      logger.info('User updated by system admin', { userId: id, updatedFields: Object.keys(updateData) });
      res.json({ message: 'User updated successfully', user: updatedUser });
    } catch (error) {
      next(error);
    }
  },

  updateUserComprehensive: async (req, res, next) => {
    try {
      const { id } = userIdSchema.parse(req.params);
      const updateData = comprehensiveUpdateSchema.parse(req.body);
      const tenantId = req.user.tenantId;

      if (!tenantId) {
        return res.status(400).json({
          message: 'Tenant ID not found in user context',
          error: 'Missing tenant context'
        });
      }

      const updatedUser = await userService.updateUserComprehensive(id, updateData, tenantId);
      
      logger.info('User updated comprehensively', { 
        userId: id, 
        tenantId,
        updatedFields: Object.keys(updateData),
        updatedBy: req.user.userId 
      });
      
      res.json({ 
        message: 'User updated successfully', 
        user: updatedUser 
      });
    } catch (error) {
      next(error);
    }
  },

  deleteUser: async (req, res, next) => {
    try {
      const { id } = userIdSchema.parse(req.params);
      await userService.deleteUser(id);
      logger.info('User deleted by system admin', { userId: id });
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      next(error);
    }
  },

  setDefaultRole: async (req, res, next) => {
    try {
      const { roleId, type, userId: bodyUserId } = req.body;
      // Use userId from body if provided (admin flow), else fallback to req.user.userId (self-service)
      const userId = bodyUserId || req.user.userId;
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required to set default role.' });
      }
      await userService.setDefaultRole({ userId, roleId, type });

      logger.info('Default role set successfully', { 
        userId, 
        roleId, 
        type 
      });

      res.json({ 
        message: 'Default role set successfully',
        roleId,
        type
      });
    } catch (error) {
      next(error);
    }
  },

  // New method for users to update their own profile
  updateProfile: async (req, res, next) => {
    try {
      const updateData = updateProfileSchema.parse(req.body);
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(400).json({ 
          message: 'User ID not found in context',
          error: 'Missing user context'
        });
      }

      const updatedUser = await userService.updateProfile({
        userId,
        updateData,
      });

      logger.info('User profile updated successfully', { 
        userId, 
        updatedFields: Object.keys(updateData)
      });

      res.status(200).json({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      logger.error('Error updating profile:', error);
      next(error);
    }
  },

  // New method for users to change their password
  changePassword: async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(400).json({ 
          message: 'User ID not found in context',
          error: 'Missing user context'
        });
      }

      await userService.changePassword({
        userId,
        currentPassword,
        newPassword,
      });

      logger.info('User password changed successfully', { userId });

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Error changing password:', error);
      next(error);
    }
  },

  setDefaultRole: async (req, res, next) => {
    try {
      const { roleId, type, userId: bodyUserId } = req.body;
      // Use userId from body if provided (admin flow), else fallback to req.user.userId (self-service)
      const userId = bodyUserId || req.user.userId;
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required to set default role.' });
      }
      await userService.setDefaultRole({ userId, roleId, type });

      logger.info('Default role set successfully', { 
        userId, 
        roleId, 
        type 
      });

      res.json({ 
        message: 'Default role set successfully',
        roleId,
        type
      });
    } catch (error) {
      next(error);
    }
  },

  // Get all HODs for the current tenant
  getHods: async (req, res, next) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID not found in user context', error: 'Missing tenant context' });
      }
      const hods = await userService.getHodsForTenant(tenantId);
      res.status(200).json({ hods });
    } catch (error) {
      next(error);
    }
  },

  // Get all users for the current tenant (SYSTEM_ADMIN only)
  getUsersForTenant: async (req, res, next) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID not found in user context', error: 'Missing tenant context' });
      }

      const { page = 1, limit = 10, search, departmentId, roleId } = req.query;
      
      const users = await userService.getUsersForTenant({
        tenantId,
        page: parseInt(page),
        limit: parseInt(limit),
        search,
        departmentId,
        roleId
      });

      logger.info('Users fetched for tenant', {
        tenantId,
        count: users.length,
        page,
        limit
      });

      res.status(200).json({
        message: 'Users fetched successfully',
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: users.length
        }
      });
    } catch (error) {
      logger.error('Error fetching users for tenant:', error);
      next(error);
    }
  },

  // Get users with specific permissions
  getUsersWithPermission: async (req, res, next) => {
    try {
      const { permission } = req.query;
      const tenantId = req.user?.tenantId;

      if (!permission) {
        return res.status(400).json({ 
          message: 'Permission parameter is required',
          error: 'Missing permission parameter'
        });
      }

      if (!tenantId) {
        return res.status(400).json({ 
          message: 'Tenant ID not found in user context', 
          error: 'Missing tenant context' 
        });
      }

      // Parse permission format (e.g., "managementReview:view")
      const [module, action] = permission.split(':');
      
      if (!module || !action) {
        return res.status(400).json({ 
          message: 'Invalid permission format. Expected format: module:action',
          error: 'Invalid permission format'
        });
      }

      const notificationService = require('../services/notificationService');
      const users = await notificationService.getUsersWithPermission(tenantId, module, action);

      logger.info('Users with permission fetched', {
        permission,
        tenantId,
        count: users.length
      });

      res.status(200).json({
        message: 'Users with permission fetched successfully',
        users,
        permission,
        count: users.length
      });
    } catch (error) {
      logger.error('Error fetching users with permission:', error);
      next(error);
    }
  },
};

module.exports = userController;