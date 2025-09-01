/**
 * ENHANCED ROLE CONTROLLER WITH SUPER ADMIN CAPABILITIES
 * Handles tenant-scoped role management and global super admin operations
 */

const roleRepository = require('../repositories/roleRepository');
const tenantService = require('../services/tenantService');
const superAdminService = require('../services/superAdminService');
const { logger } = require('../utils/logger');

class RoleController {

  /**
   * Get tenant-scoped roles (Standard Operation)
   */
  async getAllRoles(req, res) {
    try {
      const { tenantId } = req.params;
      
      if (!tenantId) {
        return res.status(400).json({ 
          error: 'Tenant ID is required for role fetching' 
        });
      }

      // Verify tenant access
      if (req.user.tenantId !== tenantId && !await this.isSuperAdmin(req.user.id)) {
        return res.status(403).json({ 
          error: 'Access denied to tenant roles' 
        });
      }

      const roles = await roleRepository.findByTenantId(tenantId);
      
      res.json({
        success: true,
        data: roles,
        tenantId,
        count: roles.length
      });

    } catch (error) {
      logger.error('Error fetching roles:', error);
      res.status(500).json({ 
        error: 'Failed to fetch roles',
        details: error.message 
      });
    }
  }

  /**
   * Get available roles for assignment (Tenant-Scoped with Hierarchy)
   */
  async getAvailableRoles(req, res) {
    try {
      const { tenantId } = req.params;
      const userRole = req.user.roles?.[0]?.name || 'STAFF';

      // Role hierarchy for assignment permissions
      const roleHierarchy = {
        'SUPER_ADMIN': ['SYSTEM_ADMIN', 'PRINCIPAL', 'MR', 'HOD', 'AUDITOR', 'HOD AUDITOR', 'STAFF'],
        'SYSTEM_ADMIN': ['PRINCIPAL', 'MR', 'HOD', 'AUDITOR', 'HOD AUDITOR', 'STAFF'],
        'PRINCIPAL': ['MR', 'HOD', 'AUDITOR', 'HOD AUDITOR', 'STAFF'],
        'MR': ['HOD', 'AUDITOR', 'HOD AUDITOR', 'STAFF'],
        'HOD': ['STAFF'],
        'AUDITOR': ['STAFF'],
        'HOD AUDITOR': ['STAFF'],
        'STAFF': []
      };

      const assignableRoleNames = roleHierarchy[userRole] || [];
      
      const roles = await roleRepository.findByTenantIdAndNames(tenantId, assignableRoleNames);
      
      res.json({
        success: true,
        data: roles,
        assignedBy: userRole,
        tenantId,
        hierarchy: assignableRoleNames
      });

    } catch (error) {
      logger.error('Error fetching available roles:', error);
      res.status(500).json({ 
        error: 'Failed to fetch available roles',
        details: error.message 
      });
    }
  }

  /**
   * SUPER ADMIN: Get global role analysis
   */
  async getGlobalRoleAnalysis(req, res) {
    try {
      // Verify super admin access
      await superAdminService.verifySuperAdminAccess(req.user.id);

      const analysis = await superAdminService.getGlobalRoleAnalysis();
      
      res.json({
        success: true,
        data: analysis,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error in global role analysis:', error);
      res.status(error.message.includes('Access denied') ? 403 : 500).json({ 
        error: 'Failed to perform global role analysis',
        details: error.message 
      });
    }
  }

  /**
   * SUPER ADMIN: System health check
   */
  async performSystemHealthCheck(req, res) {
    try {
      // Verify super admin access
      await superAdminService.verifySuperAdminAccess(req.user.id);

      const healthCheck = await superAdminService.performSystemHealthCheck();
      
      res.json({
        success: true,
        data: healthCheck
      });

    } catch (error) {
      logger.error('Error in system health check:', error);
      res.status(error.message.includes('Access denied') ? 403 : 500).json({ 
        error: 'Failed to perform system health check',
        details: error.message 
      });
    }
  }

  /**
   * SUPER ADMIN: Create super admin user
   */
  async createSuperAdmin(req, res) {
    try {
      const { email, firstName, lastName, password } = req.body;

      // Verify current user is super admin (or system initialization)
      if (req.user && req.user.id) {
        await superAdminService.verifySuperAdminAccess(req.user.id);
      }

      const superAdmin = await superAdminService.createSuperAdmin({
        email,
        firstName,
        lastName,
        password,
        createdBy: req.user?.id || 'SYSTEM_INIT'
      });

      res.status(201).json({
        success: true,
        data: {
          id: superAdmin.id,
          email: superAdmin.email,
          firstName: superAdmin.firstName,
          lastName: superAdmin.lastName,
          tenantId: superAdmin.tenantId
        },
        message: 'Super Admin created successfully'
      });

    } catch (error) {
      logger.error('Error creating super admin:', error);
      res.status(error.message.includes('Access denied') ? 403 : 400).json({ 
        error: 'Failed to create super admin',
        details: error.message 
      });
    }
  }

  /**
   * SUPER ADMIN: Get all tenants with analytics
   */
  async getAllTenantsWithAnalytics(req, res) {
    try {
      // Verify super admin access
      await superAdminService.verifySuperAdminAccess(req.user.id);

      const tenants = await superAdminService.getAllTenantsWithAnalytics();
      
      res.json({
        success: true,
        data: tenants,
        count: tenants.length,
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error fetching tenants with analytics:', error);
      res.status(error.message.includes('Access denied') ? 403 : 500).json({ 
        error: 'Failed to fetch tenant analytics',
        details: error.message 
      });
    }
  }

  /**
   * SUPER ADMIN: Move user between tenants
   */
  async moveUserBetweenTenants(req, res) {
    try {
      const { userId, fromTenantId, toTenantId } = req.body;

      // Verify super admin access
      await superAdminService.verifySuperAdminAccess(req.user.id);

      const result = await superAdminService.moveUserBetweenTenants({
        userId,
        fromTenantId,
        toTenantId,
        superAdminId: req.user.id
      });

      res.json({
        success: true,
        data: result,
        message: 'User moved between tenants successfully'
      });

    } catch (error) {
      logger.error('Error moving user between tenants:', error);
      res.status(error.message.includes('Access denied') ? 403 : 400).json({ 
        error: 'Failed to move user between tenants',
        details: error.message 
      });
    }
  }

  /**
   * Create role (Enhanced with Super Admin capabilities)
   */
  async createRole(req, res) {
    try {
      const { name, description, tenantId, permissions = [] } = req.body;
      const createdBy = req.user.id;

      // Verify permissions to create role
      const canCreateRole = await this.canCreateRole(req.user, tenantId);
      if (!canCreateRole) {
        return res.status(403).json({ 
          error: 'Insufficient permissions to create roles' 
        });
      }

      const role = await roleRepository.createWithPermissions({
        name,
        description,
        tenantId,
        permissions,
        createdBy
      });

      res.status(201).json({
        success: true,
        data: role,
        message: 'Role created successfully'
      });

    } catch (error) {
      logger.error('Error creating role:', error);
      res.status(400).json({ 
        error: 'Failed to create role',
        details: error.message 
      });
    }
  }

  /**
   * Update role (Enhanced with Super Admin capabilities)
   */
  async updateRole(req, res) {
    try {
      const { id } = req.params;
      const { name, description, permissions = [] } = req.body;

      // Get role to check tenant
      const existingRole = await roleRepository.findById(id);
      if (!existingRole) {
        return res.status(404).json({ error: 'Role not found' });
      }

      // Verify permissions to update role
      const canUpdateRole = await this.canUpdateRole(req.user, existingRole.tenantId);
      if (!canUpdateRole) {
        return res.status(403).json({ 
          error: 'Insufficient permissions to update roles' 
        });
      }

      const role = await roleRepository.updateWithPermissions({
        id,
        name,
        description,
        permissions,
        updatedBy: req.user.id
      });

      res.json({
        success: true,
        data: role,
        message: 'Role updated successfully'
      });

    } catch (error) {
      logger.error('Error updating role:', error);
      res.status(400).json({ 
        error: 'Failed to update role',
        details: error.message 
      });
    }
  }

  /**
   * Delete role (Enhanced with protection for system roles)
   */
  async deleteRole(req, res) {
    try {
      const { id } = req.params;

      // Get role to check if it's removable
      const role = await roleRepository.findById(id);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }

      if (!role.isRemovable) {
        return res.status(400).json({ 
          error: 'System roles cannot be deleted' 
        });
      }

      // Verify permissions to delete role
      const canDeleteRole = await this.canDeleteRole(req.user, role.tenantId);
      if (!canDeleteRole) {
        return res.status(403).json({ 
          error: 'Insufficient permissions to delete roles' 
        });
      }

      await roleRepository.deleteById(id);

      res.json({
        success: true,
        message: 'Role deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting role:', error);
      res.status(400).json({ 
        error: 'Failed to delete role',
        details: error.message 
      });
    }
  }

  /**
   * Helper Methods
   */
  async isSuperAdmin(userId) {
    try {
      await superAdminService.verifySuperAdminAccess(userId);
      return true;
    } catch {
      return false;
    }
  }

  async canCreateRole(user, tenantId) {
    // Super admin can create roles in any tenant
    if (await this.isSuperAdmin(user.id)) return true;
    
    // User must be in same tenant and have SYSTEM_ADMIN or PRINCIPAL role
    if (user.tenantId !== tenantId) return false;
    
    const hasPermission = user.roles?.some(role => 
      ['SYSTEM_ADMIN', 'PRINCIPAL'].includes(role.name)
    );
    
    return hasPermission;
  }

  async canUpdateRole(user, tenantId) {
    return this.canCreateRole(user, tenantId);
  }

  async canDeleteRole(user, tenantId) {
    return this.canCreateRole(user, tenantId);
  }
}

module.exports = new RoleController();
