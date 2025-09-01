const { prisma } = require('../../prisma/client');
const bcrypt = require('bcryptjs');
const { logger } = require('../utils/logger');
const brandingService = require('./brandingService');

async function onboardTenantWithAdmin(payload) {
  const {
    tenant: tenantData,
    adminUser: adminUserData
  } = payload;

  return await prisma.$transaction(async (tx) => {
    try {
      // 1. Create the tenant
      const tenant = await tx.tenant.create({
        data: {
          ...tenantData,
          createdBy: 'system', // Will be updated with actual user ID if available
          status: 'ACTIVE',
          subscriptionStatus: 'ACTIVE'
        }
      });

      logger.info('Tenant created successfully', { tenantId: tenant.id, tenantName: tenant.name });

      // 2. Initialize branding for the tenant
      const brandingData = {
        primaryColor: tenantData.primaryColor || '#00A79D',
        secondaryColor: tenantData.secondaryColor || '#EF8201',
        tagline: tenantData.tagline || '',
        description: tenantData.description || '',
        metaTitle: tenantData.metaTitle || tenant.name,
        metaDescription: tenantData.metaDescription || '',
        metaKeywords: tenantData.metaKeywords || '',
        logoUrl: tenantData.logoUrl || null,
        faviconUrl: tenantData.faviconUrl || null
      };

      const branding = await tx.tenantBranding.create({
        data: {
          tenantId: tenant.id,
          ...brandingData
        }
      });

      logger.info('Branding initialized for tenant', { tenantId: tenant.id, brandingId: branding.id });

      // 3. Create SYSTEM_ADMIN role for the tenant
      const systemAdminRole = await tx.role.create({
        data: {
          name: 'SYSTEM_ADMIN',
          description: 'System Administrator with full access to all features and settings',
          tenantId: tenant.id,
          roleScope: 'tenant',
          defaultContext: 'dashboard',
          isDefault: true,
          isRemovable: false,
          loginDestination: '/admin/dashboard'
        }
      });

      logger.info('SYSTEM_ADMIN role created for tenant', { tenantId: tenant.id, roleId: systemAdminRole.id });

      // 4. Create the admin user
      const hashedPassword = await bcrypt.hash(adminUserData.password, 10);
      
      const adminUser = await tx.user.create({
        data: {
          ...adminUserData,
          password: hashedPassword,
          tenantId: tenant.id,
          createdBy: 'system',
          verified: true
        }
      });

      logger.info('Admin user created successfully', { userId: adminUser.id, email: adminUser.email });

      // 5. Assign SYSTEM_ADMIN role to the admin user
      const userRole = await tx.userRole.create({
        data: {
          userId: adminUser.id,
          roleId: systemAdminRole.id,
          isDefault: true
        }
      });

      logger.info('SYSTEM_ADMIN role assigned to admin user', { 
        userId: adminUser.id, 
        roleId: systemAdminRole.id,
        userRoleId: userRole.id 
      });

      // 6. Create main campus for the tenant
      const mainCampus = await tx.campus.create({
        data: {
          name: 'Main Campus',
          address: tenantData.address || '',
          city: tenantData.city || '',
          county: tenantData.county || '',
          country: tenantData.country || 'Kenya',
          phone: tenantData.phone || '',
          email: tenantData.email || '',
          isMain: true,
          tenantId: tenant.id
        }
      });

      logger.info('Main campus created for tenant', { tenantId: tenant.id, campusId: mainCampus.id });

      // 7. Create core permissions for SYSTEM_ADMIN role
      const corePermissions = [
        // Tenant management
        { module: 'tenant', action: 'read' },
        { module: 'tenant', action: 'update' },
        { module: 'tenant', action: 'delete' },
        
        // User management
        { module: 'user', action: 'create' },
        { module: 'user', action: 'read' },
        { module: 'user', action: 'update' },
        { module: 'user', action: 'delete' },
        
        // Role management
        { module: 'role', action: 'create' },
        { module: 'role', action: 'read' },
        { module: 'role', action: 'update' },
        { module: 'role', action: 'delete' },
        
        // Department management
        { module: 'department', action: 'create' },
        { module: 'department', action: 'read' },
        { module: 'department', action: 'update' },
        { module: 'department', action: 'delete' },
        
        // Document management
        { module: 'document', action: 'create' },
        { module: 'document', action: 'read' },
        { module: 'document', action: 'update' },
        { module: 'document', action: 'delete' },
        { module: 'document', action: 'approve' },
        
        // Audit management
        { module: 'audit', action: 'create' },
        { module: 'audit', action: 'read' },
        { module: 'audit', action: 'update' },
        { module: 'audit', action: 'delete' },
        { module: 'audit', action: 'approve' },
        
        // Branding management
        { module: 'branding', action: 'read' },
        { module: 'branding', action: 'update' },
        
        // File upload
        { module: 'upload', action: 'create' },
        { module: 'upload', action: 'delete' }
      ];

      // Create permissions and assign to SYSTEM_ADMIN role
      for (const permissionData of corePermissions) {
        // Get or create permission
        let permission = await tx.permission.findUnique({
          where: { module_action: { module: permissionData.module, action: permissionData.action } }
        });

        if (!permission) {
          permission = await tx.permission.create({
            data: permissionData
          });
        }

        // Assign permission to SYSTEM_ADMIN role
        await tx.rolePermission.create({
          data: {
            roleId: systemAdminRole.id,
            permissionId: permission.id,
            allowed: true
          }
        });
      }

      logger.info('Core permissions assigned to SYSTEM_ADMIN role', { 
        tenantId: tenant.id, 
        roleId: systemAdminRole.id,
        permissionCount: corePermissions.length 
      });

      return {
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          domain: tenant.domain,
          status: tenant.status
        },
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName
        },
        branding: {
          id: branding.id,
          primaryColor: branding.primaryColor,
          secondaryColor: branding.secondaryColor,
          logoUrl: branding.logoUrl,
          faviconUrl: branding.faviconUrl
        },
        systemAdminRole: {
          id: systemAdminRole.id,
          name: systemAdminRole.name
        },
        mainCampus: {
          id: mainCampus.id,
          name: mainCampus.name
        },
        isSystemAdminCreated: true
      };

    } catch (error) {
      logger.error('Error during tenant onboarding:', error);
      throw error;
    }
  });
}

module.exports = {
  onboardTenantWithAdmin
};