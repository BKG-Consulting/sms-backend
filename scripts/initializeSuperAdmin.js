/**
 * SUPER ADMIN INITIALIZATION SCRIPT
 * Creates the first super admin user and sets up enterprise architecture
 */

const { prisma } = require('./prisma/client');
const bcrypt = require('bcryptjs');

async function initializeSuperAdmin() {
  console.log('🚀 Starting Super Admin Initialization...');
  
  try {
    await prisma.$transaction(async (tx) => {
      console.log('📋 Step 1: Creating Default Tenant...');
      
      // 1. Create or get default tenant for super admin
      let defaultTenant = await tx.tenant.findUnique({
        where: { id: 'default-tenant' }
      });

      if (!defaultTenant) {
        defaultTenant = await tx.tenant.create({
          data: {
            id: 'default-tenant',
            name: 'System Administration',
            subdomain: 'system-admin',
            isActive: true,
            createdBy: 'SYSTEM_INIT'
          }
        });
        console.log('✅ Default tenant created');
      } else {
        console.log('✅ Default tenant already exists');
      }

      console.log('📋 Step 2: Creating Super Admin Role...');
      
      // 2. Create SUPER_ADMIN role in default tenant
      let superAdminRole = await tx.role.findFirst({
        where: { 
          name: 'SUPER_ADMIN',
          tenantId: 'default-tenant'
        }
      });

      if (!superAdminRole) {
        superAdminRole = await tx.role.create({
          data: {
            id: 'default-tenant-super_admin',
            name: 'SUPER_ADMIN',
            description: 'Global System Administrator with access to all tenants',
            tenantId: 'default-tenant',
            loginDestination: '/super-admin-dashboard',
            defaultContext: 'global',
            isDefault: true,
            isRemovable: false
          }
        });
        console.log('✅ Super Admin role created');
      } else {
        console.log('✅ Super Admin role already exists');
      }

      console.log('📋 Step 3: Creating Super Admin Permissions...');
      
      // 3. Create comprehensive permissions for super admin
      const superAdminPermissions = [
        { name: 'GLOBAL_TENANT_MANAGEMENT', action: 'manage', description: 'Manage all tenants globally' },
        { name: 'CROSS_TENANT_USER_MANAGEMENT', action: 'manage', description: 'Move users between tenants' },
        { name: 'SYSTEM_HEALTH_MONITORING', action: 'view', description: 'View system health and analytics' },
        { name: 'GLOBAL_ROLE_ANALYSIS', action: 'view', description: 'Analyze roles across all tenants' },
        { name: 'SYSTEM_CONFIGURATION', action: 'manage', description: 'Manage system-wide configuration' },
        { name: 'AUDIT_LOG_ACCESS', action: 'view', description: 'Access all audit logs' },
        { name: 'TENANT_CREATION', action: 'create', description: 'Create new tenants' },
        { name: 'GLOBAL_USER_MANAGEMENT', action: 'manage', description: 'Manage users across all tenants' },
        { name: 'SYSTEM_ADMIN_CREATION', action: 'create', description: 'Create system administrators' },
        { name: 'ENTERPRISE_REPORTING', action: 'view', description: 'Access enterprise-level reports' }
      ];

      for (const perm of superAdminPermissions) {
        let permission = await tx.permission.findFirst({
          where: { name: perm.name, action: perm.action }
        });

        if (!permission) {
          permission = await tx.permission.create({
            data: perm
          });
        }

        // Assign permission to super admin role
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: superAdminRole.id,
              permissionId: permission.id
            }
          },
          update: {},
          create: {
            roleId: superAdminRole.id,
            permissionId: permission.id
          }
        });
      }
      
      console.log(`✅ ${superAdminPermissions.length} permissions assigned to Super Admin`);

      console.log('📋 Step 4: Checking for existing Super Admin user...');
      
      // 4. Check if super admin user already exists
      const existingSuperAdmin = await tx.userRole.findFirst({
        where: {
          role: { name: 'SUPER_ADMIN' }
        },
        include: { user: true }
      });

      if (existingSuperAdmin) {
        console.log(`✅ Super Admin already exists: ${existingSuperAdmin.user.email}`);
        return {
          status: 'exists',
          email: existingSuperAdmin.user.email,
          userId: existingSuperAdmin.user.id
        };
      }

      console.log('📋 Step 5: Creating Super Admin User...');
      
      // 5. Create super admin user
      const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'superadmin@system.local';
      const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin@2024!';
      
      const hashedPassword = await bcrypt.hash(superAdminPassword, 12);

      const superAdminUser = await tx.user.create({
        data: {
          email: superAdminEmail,
          firstName: 'Super',
          lastName: 'Administrator',
          password: hashedPassword,
          tenantId: 'default-tenant',
          verified: true,
          createdBy: 'SYSTEM_INIT',
          isSystemUser: true
        }
      });

      // 6. Assign super admin role
      await tx.userRole.create({
        data: {
          userId: superAdminUser.id,
          roleId: superAdminRole.id,
          isDefault: true
        }
      });

      console.log('✅ Super Admin user created successfully');
      
      return {
        status: 'created',
        email: superAdminUser.email,
        userId: superAdminUser.id,
        password: superAdminPassword
      };
    });

  } catch (error) {
    console.error('❌ Super Admin initialization failed:', error);
    throw error;
  }
}

async function validateSystemHealth() {
  console.log('🔍 Running System Health Validation...');
  
  try {
    // Check tenant isolation
    const crossTenantIssues = await prisma.userRole.findMany({
      where: {
        user: {
          tenantId: {
            not: {
              equals: prisma.role.fields.tenantId
            }
          }
        }
      },
      take: 5
    });

    if (crossTenantIssues.length > 0) {
      console.log(`⚠️  Warning: ${crossTenantIssues.length} cross-tenant role assignment issues detected`);
    } else {
      console.log('✅ Tenant isolation verified');
    }

    // Check role hierarchy
    const requiredRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'PRINCIPAL', 'MR', 'HOD', 'STAFF'];
    const existingRoles = await prisma.role.groupBy({
      by: ['name'],
      _count: { name: true }
    });

    const existingRoleNames = existingRoles.map(r => r.name);
    const missingRoles = requiredRoles.filter(role => !existingRoleNames.includes(role));

    if (missingRoles.length > 0) {
      console.log(`⚠️  Warning: Missing required roles: ${missingRoles.join(', ')}`);
    } else {
      console.log('✅ Role hierarchy complete');
    }

    // Check orphaned permissions
    const orphanedPermissions = await prisma.permission.findMany({
      where: {
        rolePermissions: {
          none: {}
        }
      },
      take: 5
    });

    if (orphanedPermissions.length > 0) {
      console.log(`⚠️  Warning: ${orphanedPermissions.length} orphaned permissions found`);
    } else {
      console.log('✅ Permission coverage optimal');
    }

    console.log('✅ System health validation complete');

  } catch (error) {
    console.error('❌ System health validation failed:', error);
  }
}

async function main() {
  console.log('🏗️  ENTERPRISE RBAC SYSTEM INITIALIZATION');
  console.log('=========================================');
  
  try {
    // Initialize super admin
    const result = await initializeSuperAdmin();
    
    console.log('\n📊 SUPER ADMIN SETUP COMPLETE');
    console.log('==============================');
    console.log(`Status: ${result.status}`);
    console.log(`Email: ${result.email}`);
    console.log(`User ID: ${result.userId}`);
    
    if (result.status === 'created') {
      console.log(`Password: ${result.password}`);
      console.log('\n⚠️  IMPORTANT: Change the default password immediately after first login!');
    }

    // Validate system health
    console.log('\n🔍 SYSTEM HEALTH CHECK');
    console.log('=====================');
    await validateSystemHealth();

    console.log('\n🎉 ENTERPRISE INITIALIZATION COMPLETE!');
    console.log('======================================');
    console.log('Next Steps:');
    console.log('1. Login as Super Admin');
    console.log('2. Change default password');
    console.log('3. Run comprehensive health check via API');
    console.log('4. Configure additional system administrators');
    console.log('5. Review tenant configurations');

  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running as script or importing as module
if (require.main === module) {
  main();
}

module.exports = {
  initializeSuperAdmin,
  validateSystemHealth
};
