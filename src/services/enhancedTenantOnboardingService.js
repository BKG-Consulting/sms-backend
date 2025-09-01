const { prisma } = require('../../prisma/client');
const tenantRepository = require('../repositories/tenantRepository');
const { createCampus } = require('../repositories/campus.repository');
const { createDepartment } = require('../repositories/departmentRepository');
const roleRepository = require('../repositories/roleRepository');
const rolePermissionService = require('./rolePermissionService');
const bcrypt = require('bcryptjs');
const brandingService = require('./brandingService');
const { logEvent } = require('../utils/eventLogger');
const { getAvailableRoles } = require('../../constants/rolePermissions');

// Essential roles that every tenant should have
const ESSENTIAL_ROLES = [
  'SYSTEM_ADMIN',  // Already created in onboarding
  'ADMIN',         // Institution admin
  'HOD',           // Head of Department
  'STAFF',         // Basic staff members
  'AUDITOR',       // For audit functionality
  'PRINCIPAL'      // For institutional oversight
];

async function createEssentialRolesForTenant(tenantId, tx = prisma) {
  console.log(`Creating essential roles for tenant: ${tenantId}`);
  
  const createdRoles = {};
  const predefinedTemplates = getAvailableRoles();
  
  for (const roleName of ESSENTIAL_ROLES) {
    try {
      // Check if role already exists
      const existingRole = await tx.role.findFirst({
        where: { 
          name: roleName, 
          tenantId: tenantId 
        }
      });
      
      if (existingRole) {
        console.log(`Role ${roleName} already exists for tenant ${tenantId}`);
        createdRoles[roleName] = existingRole;
        continue;
      }
      
      // Create the role
      const role = await tx.role.create({
        data: {
          name: roleName,
          description: getRoleDescription(roleName),
          tenantId: tenantId,
          loginDestination: '/dashboard',
          defaultContext: 'dashboard',
          isDefault: roleName === 'STAFF', // STAFF is default for new users
          isRemovable: roleName !== 'SYSTEM_ADMIN' // SYSTEM_ADMIN cannot be removed
        }
      });
      
      console.log(`✅ Created role: ${roleName} (${role.id})`);
      createdRoles[roleName] = role;
      
      // Auto-assign permissions if it's a predefined role
      if (predefinedTemplates.includes(roleName)) {
        try {
          await rolePermissionService.assignPermissionsToRole(role.id, roleName, tenantId);
          console.log(`✅ Assigned permissions to ${roleName}`);
        } catch (permError) {
          console.warn(`⚠️  Failed to assign permissions to ${roleName}:`, permError.message);
        }
      }
      
    } catch (error) {
      console.error(`❌ Failed to create role ${roleName} for tenant ${tenantId}:`, error.message);
      throw error;
    }
  }
  
  return createdRoles;
}

function getRoleDescription(roleName) {
  const descriptions = {
    'SYSTEM_ADMIN': 'System administrator with full tenant management permissions',
    'ADMIN': 'Institution administrator with management capabilities',
    'HOD': 'Head of Department for department-specific management',
    'STAFF': 'Staff member with basic access to institutional resources',
    'AUDITOR': 'Auditor for conducting institutional audits and assessments',
    'PRINCIPAL': 'Principal for institutional oversight and approval processes'
  };
  return descriptions[roleName] || `${roleName} role for institutional operations`;
}

async function onboardTenantWithAdmin(payload) {
  console.log('🚀 Starting enhanced tenant onboarding...');
  
  try {
    // Use longer transaction timeout for complex onboarding
    const result = await prisma.$transaction(async (tx) => {
      // 1. Check for existing tenant (idempotency)
      const existing = await tenantRepository.findTenantByDomainOrEmail(payload.tenant.domain, payload.tenant.email);
      if (existing) {
        throw { code: 'P2002', meta: { target: ['domain/email'] } };
      }

      // 2. Create Tenant
      console.log('Creating tenant...');
      const tenant = await tenantRepository.createTenant({
        name: payload.tenant.name,
        domain: payload.tenant.domain,
        email: payload.tenant.email,
        type: payload.tenant.type,
        logoUrl: payload.tenant.logoUrl,
        phone: payload.tenant.phone,
        accreditationNumber: payload.tenant.accreditationNumber,
        establishedYear: payload.tenant.establishedYear,
        timezone: payload.tenant.timezone,
        currency: payload.tenant.currency,
        address: payload.tenant.address,
        city: payload.tenant.city,
        county: payload.tenant.county,
        country: payload.tenant.country,
        website: payload.tenant.website,
        postalCode: payload.tenant.postalCode,
        registrationNumber: payload.tenant.registrationNumber,
        legalName: payload.tenant.legalName,
        contactPerson: payload.tenant.contactPerson,
        contactEmail: payload.tenant.contactEmail,
        contactPhone: payload.tenant.contactPhone,
        subscriptionPlan: payload.tenant.subscriptionPlan,
        maxUsers: parseInt(payload.tenant.maxUsers) || 10,
        maxStorageGB: parseInt(payload.tenant.maxStorageGB) || 5,
        createdBy: payload.createdBy,
      });

      console.log(`✅ Tenant created: ${tenant.name} (${tenant.id})`);

      // 3. Create Main Campus
      const campus = await require('../repositories/campus.repository').createCampus({
        name: 'Main Campus',
        address: payload.tenant.address || '',
        city: payload.tenant.city || '',
        county: payload.tenant.county || '',
        country: payload.tenant.country || 'Kenya',
        phone: payload.tenant.phone || '',
        email: payload.tenant.email,
        isMain: true,
        tenantId: tenant.id,
      });
      console.log(`✅ Main campus created: ${campus.name} (${campus.id})`);

      // 4. Create System Department
      const department = await require('../repositories/departmentRepository').createDepartment({
        name: 'Administration',
        code: 'ADMIN',
        tenantId: tenant.id,
        campusId: campus.id,
      });
      console.log(`✅ System department created: ${department.name} (${department.id})`);

      // 5. Create Essential Roles (simplified - no permission assignment in transaction)
      const roles = {};
      for (const roleName of ESSENTIAL_ROLES) {
        const role = await tx.role.create({
          data: {
            name: roleName,
            description: getRoleDescription(roleName),
            tenantId: tenant.id,
            loginDestination: '/dashboard',
            defaultContext: 'dashboard',
            isDefault: roleName === 'STAFF',
            isRemovable: roleName !== 'SYSTEM_ADMIN'
          }
        });
        roles[roleName] = role;
        console.log(`✅ Created role: ${roleName} (${role.id})`);
      }

      // 6. Create System Admin User
      const hashedPassword = await bcrypt.hash(payload.adminUser.password, 10);
      const user = await tx.user.create({
        data: {
          email: payload.adminUser.email,
          password: hashedPassword,
          firstName: payload.adminUser.firstName,
          lastName: payload.adminUser.lastName,
          tenant: { connect: { id: tenant.id } },
          campus: { connect: { id: campus.id } },
          verified: true,
          createdBy: payload.createdBy,
        },
      });
      console.log(`✅ System admin user created: ${user.email} (${user.id})`);

      // 7. Assign SYSTEM_ADMIN Role
      const systemAdminRole = roles['SYSTEM_ADMIN'];
      await tx.userDepartmentRole.create({
        data: {
          userId: user.id,
          departmentId: department.id,
          roleId: systemAdminRole.id,
          isPrimaryDepartment: true,
          isPrimaryRole: true,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: systemAdminRole.id,
          isDefault: true,
        },
      });
      console.log('✅ SYSTEM_ADMIN role assigned to user');

      return {
        tenant,
        campus,
        department,
        roles,
        user,
        isSystemAdminCreated: true,
        message: 'Tenant onboarded successfully with essential roles'
      };
    }, {
      maxWait: 10000, // 10 seconds max wait
      timeout: 15000, // 15 seconds timeout
    });

    // 8. Create Branding (outside transaction to avoid timeout)
    const brandingData = {
      primaryColor: payload.tenant.primaryColor || '#00A79D',
      secondaryColor: payload.tenant.secondaryColor || '#EF8201',
      tagline: payload.tenant.tagline || '',
      description: payload.tenant.description || '',
      metaTitle: payload.tenant.metaTitle || result.tenant.name,
      metaDescription: payload.tenant.metaDescription || '',
      metaKeywords: payload.tenant.metaKeywords || '',
      logoUrl: payload.tenant.logoUrl || null,
      faviconUrl: payload.tenant.faviconUrl || null
    };
    await brandingService.initializeBrandingForTenant(result.tenant.id, brandingData);
    console.log('✅ Branding created');

    // 9. Assign permissions to roles (outside transaction to avoid timeout)
    console.log('🔧 Assigning permissions to roles...');
    const predefinedTemplates = getAvailableRoles();
    
    for (const [roleName, role] of Object.entries(result.roles)) {
      if (predefinedTemplates.includes(roleName)) {
        try {
          await rolePermissionService.assignPermissionsToRole(role.id, roleName, result.tenant.id);
          console.log(`✅ Assigned permissions to ${roleName}`);
        } catch (permError) {
          console.warn(`⚠️  Failed to assign permissions to ${roleName}:`, permError.message);
        }
      }
    }

    // 10. Log the event
    await logEvent('TENANT_ONBOARDED', 'TENANT', result.tenant.id, {
      tenantName: result.tenant.name,
      adminEmail: payload.adminUser.email,
      rolesCreated: Object.keys(result.roles),
      campusCreated: result.campus.name,
      departmentCreated: result.department.name
    });

    console.log('🎉 Enhanced tenant onboarding completed successfully!');
    return result;

  } catch (error) {
    console.error('❌ Enhanced tenant onboarding failed:', error);
    throw error;
  }
}

module.exports = { 
  onboardTenantWithAdmin,
  createEssentialRolesForTenant,
  ESSENTIAL_ROLES
};
