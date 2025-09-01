require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

/**
 * 🌟 SCHOOL MANAGEMENT SYSTEM SEED FILE
 * 
 * This seed file sets up the foundational system for our enterprise-grade
 * school management system with proper RBAC and multi-tenancy.
 */

async function seedSystemTenant() {
  console.log('🏢 Creating system tenant for system-wide roles...');

  try {
    const systemTenant = await prisma.tenant.upsert({
      where: { id: 'system' },
      update: {},
      create: {
        id: 'system',
        name: 'System',
        domain: 'system.local',
        email: 'system@dualdimension.org',
                 type: 'UNIVERSITY',
        status: 'ACTIVE',
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    console.log(`✅ System tenant created: ${systemTenant.name} (ID: ${systemTenant.id})`);
    return systemTenant;
  } catch (error) {
    console.error('❌ Error creating system tenant:', error);
    throw error;
  }
}

async function seedSystemRoles() {
  console.log('🔐 Seeding system-level roles...');

  // System-wide roles (using system tenant)
  const systemRoles = [
    {
      name: 'SUPER_ADMIN',
      displayName: 'Super Administrator',
      description: 'Top-level system administrator with full access to all tenants and system functions',
      isSystemRole: true,
      isDefault: false,
      loginDestination: '/super-admin/dashboard'
    },
    {
      name: 'SYSTEM_ADMIN',
      displayName: 'System Administrator', 
      description: 'System administrator with tenant management capabilities',
      isSystemRole: true,
      isDefault: false,
      loginDestination: '/system-admin/dashboard'
    }
  ];

  const createdRoles = {};
  
  for (const role of systemRoles) {
    try {
      const createdRole = await prisma.role.upsert({
        where: { 
          tenantId_name: {
            tenantId: 'system',
            name: role.name
          }
        },
        update: {
          displayName: role.displayName,
          description: role.description,
          isSystemRole: role.isSystemRole,
          isDefault: role.isDefault,
          loginDestination: role.loginDestination
        },
        create: {
          id: `system-${role.name.toLowerCase()}`,
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          tenantId: 'system', // System roles use system tenant
          isSystemRole: role.isSystemRole,
          isDefault: role.isDefault,
          loginDestination: role.loginDestination
        }
      });
      
      createdRoles[role.name] = createdRole;
      console.log(`✅ System role created: ${role.name} (ID: ${createdRole.id})`);
    } catch (error) {
      console.error(`❌ Error creating system role ${role.name}:`, error);
      throw error;
    }
  }

  return createdRoles;
}

async function seedSystemPermissions() {
  console.log('🔑 Seeding system-level permissions...');

  // System-wide permissions (no tenantId - these are global)
  const systemPermissions = [
    // Tenant Management
    { module: 'tenant', action: 'create', description: 'Create new tenant' },
    { module: 'tenant', action: 'read', description: 'View tenant information' },
    { module: 'tenant', action: 'update', description: 'Update tenant settings' },
    { module: 'tenant', action: 'delete', description: 'Delete tenant' },
    { module: 'tenant', action: 'suspend', description: 'Suspend tenant' },
    { module: 'tenant', action: 'activate', description: 'Activate tenant' },
    
    // System Administration
    { module: 'system', action: 'configure', description: 'Configure system settings' },
    { module: 'system', action: 'monitor', description: 'Monitor system health' },
    { module: 'system', action: 'backup', description: 'Manage system backups' },
    { module: 'system', action: 'restore', description: 'Restore system from backup' },
    
    // User Management (System Level)
    { module: 'user', action: 'create', description: 'Create system users' },
    { module: 'user', action: 'read', description: 'View system users' },
    { module: 'user', action: 'update', description: 'Update system users' },
    { module: 'user', action: 'delete', description: 'Delete system users' },
    
    // Role Management (System Level)
    { module: 'role', action: 'create', description: 'Create system roles' },
    { module: 'role', action: 'read', description: 'View system roles' },
    { module: 'role', action: 'update', description: 'Update system roles' },
    { module: 'role', action: 'delete', description: 'Delete system roles' },
    
    // Permission Management
    { module: 'permission', action: 'create', description: 'Create permissions' },
    { module: 'permission', action: 'read', description: 'View permissions' },
    { module: 'permission', action: 'update', description: 'Update permissions' },
    { module: 'permission', action: 'delete', description: 'Delete permissions' },
    
    // System Logs & Monitoring
    { module: 'auditLog', action: 'read', description: 'View system audit logs' },
    { module: 'auditLog', action: 'export', description: 'Export system audit logs' },
    { module: 'systemLog', action: 'read', description: 'View system logs' },
    { module: 'systemLog', action: 'export', description: 'Export system logs' },
    
    // Security & Compliance
    { module: 'security', action: 'configure', description: 'Configure security settings' },
    { module: 'security', action: 'monitor', description: 'Monitor security events' },
    { module: 'compliance', action: 'audit', description: 'Audit compliance status' },
    { module: 'compliance', action: 'report', description: 'Generate compliance reports' }
  ];

  const createdPermissions = {};
  
  for (const perm of systemPermissions) {
    try {
      const created = await prisma.permission.upsert({
        where: { 
          module_action_tenantId: { 
            module: perm.module, 
            action: perm.action,
            tenantId: 'system'
          } 
        },
        update: { description: perm.description },
        create: {
          ...perm,
          tenantId: 'system' // System permissions use system tenant
        }
      });
      
      createdPermissions[`${perm.module}:${perm.action}`] = created;
      console.log(`✅ System permission created: ${perm.module}:${perm.action}`);
    } catch (error) {
      console.error(`❌ Error creating system permission ${perm.module}:${perm.action}:`, error);
      throw error;
    }
  }

  return createdPermissions;
}

async function seedSuperAdmin() {
  console.log('👑 Seeding Super Administrator...');

  try {
    // Create super admin user
    const superAdminId = uuidv4();
    const hashedPassword = await bcrypt.hash('SuperAdmin@2024!', 12);
    
    const superAdmin = await prisma.user.upsert({
      where: { email: 'superadmin@dualdimension.org' },
      update: {
        password: hashedPassword,
        verified: true,
        active: true,
        firstName: 'Super',
        lastName: 'Administrator',
        updatedAt: new Date()
      },
              create: {
          id: superAdminId,
          email: 'superadmin@dualdimension.org',
          password: hashedPassword,
          firstName: 'Super',
          lastName: 'Administrator',
          verified: true,
          active: true,
          createdBy: 'system',
          tenantId: 'system', // Super admin uses system tenant
          createdAt: new Date(),
          updatedAt: new Date()
        }
    });

    console.log(`✅ Super Admin user created: ${superAdmin.email} (ID: ${superAdmin.id})`);

    // Get the SUPER_ADMIN role
    const superAdminRole = await prisma.role.findFirst({
      where: { 
        name: 'SUPER_ADMIN',
        tenantId: 'system'
      }
    });

    if (!superAdminRole) {
      throw new Error('SUPER_ADMIN role not found');
    }

    // Assign SUPER_ADMIN role to the user
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superAdmin.id,
          roleId: superAdminRole.id
        }
      },
      update: { isDefault: true },
      create: {
        userId: superAdmin.id,
        roleId: superAdminRole.id,
        isDefault: true,
        assignedAt: new Date(),
        assignedBy: 'system'
      }
    });

    console.log(`✅ SUPER_ADMIN role assigned to Super Administrator`);

    return superAdmin;
  } catch (error) {
    console.error('❌ Error seeding Super Administrator:', error);
    throw error;
  }
}

async function assignSystemPermissionsToRoles(systemRoles, systemPermissions) {
  console.log('🔗 Assigning system permissions to system roles...');

  try {
    for (const roleName of Object.keys(systemRoles)) {
      const role = systemRoles[roleName];
      let permissionsToAssign = [];

      // Define role-specific permissions
      switch (roleName) {
        case 'SUPER_ADMIN':
          // Super admin gets ALL system permissions
          permissionsToAssign = Object.keys(systemPermissions);
          break;
        
        case 'SYSTEM_ADMIN':
          // System admin gets most permissions except super-sensitive ones
          permissionsToAssign = Object.keys(systemPermissions).filter(key => 
            !key.includes('system:backup') && 
            !key.includes('system:restore') &&
            !key.includes('security:configure') &&
            !key.includes('compliance:audit')
          );
          break;
        
        default:
          // Default minimal permissions
          permissionsToAssign = Object.keys(systemPermissions).filter(key => 
            key.includes('read') || key.includes('view')
          );
      }

      // Assign permissions to role
      for (const permissionKey of permissionsToAssign) {
        const permission = systemPermissions[permissionKey];
        if (permission) {
          await prisma.rolePermission.upsert({
            where: { 
              roleId_permissionId: { 
                roleId: role.id, 
                permissionId: permission.id 
              } 
            },
            update: { allowed: true },
            create: {
              roleId: role.id,
              permissionId: permission.id,
              allowed: true
            }
          });
        }
      }
      
      console.log(`✅ ${roleName}: Assigned ${permissionsToAssign.length} system permissions`);
    }
  } catch (error) {
    console.error('❌ Error assigning system permissions to roles:', error);
    throw error;
  }
}

async function seedTenantOnboardingTemplates() {
  console.log('🏫 Seeding tenant onboarding templates...');

  try {
    // Create default campus template
    const defaultCampus = {
      name: 'Main Campus',
      address: 'Main Street',
      city: 'Nairobi',
      county: 'Nairobi',
      phone: '+254700000000',
      email: 'info@school.com',
      isMain: true
    };

    // Create default academic year template
    const currentYear = new Date().getFullYear();
    const defaultAcademicYear = {
      name: `${currentYear}/${currentYear + 1}`,
      startDate: new Date(currentYear, 0, 1), // January 1st
      endDate: new Date(currentYear, 11, 31), // December 31st
      isActive: true
    };

    // Create default terms template
    const defaultTerms = [
      {
        name: 'Term 1',
        startDate: new Date(currentYear, 0, 15), // Mid-January
        endDate: new Date(currentYear, 3, 15),   // Mid-April
        isActive: false
      },
      {
        name: 'Term 2', 
        startDate: new Date(currentYear, 4, 15), // Mid-May
        endDate: new Date(currentYear, 7, 15),   // Mid-August
        isActive: false
      },
      {
        name: 'Term 3',
        startDate: new Date(currentYear, 8, 15), // Mid-September
        endDate: new Date(currentYear, 11, 15),  // Mid-December
        isActive: false
      }
    ];

    // Create default class levels template
    const defaultClassLevels = [
      { name: 'Form 1', level: 1, type: 'SECONDARY' },
      { name: 'Form 2', level: 2, type: 'SECONDARY' },
      { name: 'Form 3', level: 3, type: 'SECONDARY' },
      { name: 'Form 4', level: 4, type: 'SECONDARY' }
    ];

    // Create default class streams template
    const defaultClassStreams = [
      { name: 'A', code: 'A' },
      { name: 'B', code: 'B' },
      { name: 'C', code: 'C' },
      { name: 'D', code: 'D' }
    ];

    // Create default subjects template
    const defaultSubjects = [
      { name: 'Mathematics', code: 'MATH', category: 'CORE', isCompulsory: true },
      { name: 'English', code: 'ENG', category: 'CORE', isCompulsory: true },
      { name: 'Kiswahili', code: 'KISW', category: 'CORE', isCompulsory: true },
      { name: 'Biology', code: 'BIO', category: 'SCIENCE', isCompulsory: true },
      { name: 'Chemistry', code: 'CHEM', category: 'SCIENCE', isCompulsory: true },
      { name: 'Physics', code: 'PHY', category: 'SCIENCE', isCompulsory: true },
      { name: 'History', code: 'HIST', category: 'ARTS', isCompulsory: false },
      { name: 'Geography', code: 'GEO', category: 'ARTS', isCompulsory: false },
      { name: 'Religious Education', code: 'RE', category: 'RELIGIOUS', isCompulsory: false },
      { name: 'Computer Studies', code: 'COMP', category: 'TECHNICAL', isCompulsory: false }
    ];

    console.log('✅ Tenant onboarding templates defined (will be created during tenant onboarding)');
    
    return {
      defaultCampus,
      defaultAcademicYear,
      defaultTerms,
      defaultClassLevels,
      defaultClassStreams,
      defaultSubjects
    };
  } catch (error) {
    console.error('❌ Error seeding tenant onboarding templates:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting School Management System seeding...');
  console.log('================================================');

  try {
    // Step 1: Create system tenant
    const systemTenant = await seedSystemTenant();
    
    // Step 2: Seed system roles
    const systemRoles = await seedSystemRoles();
    
    // Step 2: Seed system permissions
    const systemPermissions = await seedSystemPermissions();
    
    // Step 3: Assign permissions to roles
    await assignSystemPermissionsToRoles(systemRoles, systemPermissions);
    
    // Step 4: Seed super administrator
    const superAdmin = await seedSuperAdmin();
    
    // Step 5: Seed tenant onboarding templates
    const onboardingTemplates = await seedTenantOnboardingTemplates();

    console.log('================================================');
    console.log('🎉 School Management System seeding completed successfully!');
    console.log('================================================');
    console.log('📋 Summary:');
    console.log(`   • System Roles: ${Object.keys(systemRoles).length}`);
    console.log(`   • System Permissions: ${Object.keys(systemPermissions).length}`);
    console.log(`   • Super Administrator: ${superAdmin.email}`);
    console.log(`   • Onboarding Templates: Ready for tenant creation`);
    console.log('');
    console.log('🔑 Super Admin Login Credentials:');
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Password: SuperAdmin@2024!`);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the default password after first login!');
    console.log('================================================');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Prisma disconnected');
  }
}

// Run the seeding process
if (require.main === module) {
  main();
}

module.exports = {
  seedSystemRoles,
  seedSystemPermissions,
  seedSuperAdmin,
  seedTenantOnboardingTemplates
};
