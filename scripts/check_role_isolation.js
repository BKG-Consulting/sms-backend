// Script to check role and tenant isolation
const { prisma } = require('../prisma/client');

async function checkRoleTenantIsolation() {
  console.log('🔍 Checking Role and Tenant Isolation...\n');

  try {
    // 1. Check all tenants
    console.log('📊 TENANTS:');
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        status: true,
        _count: {
          select: {
            roles: true,
            users: true
          }
        }
      }
    });

    if (tenants.length === 0) {
      console.log('❌ No tenants found. Database appears to be clean.');
    } else {
      tenants.forEach(tenant => {
        console.log(`   Tenant: ${tenant.name} (${tenant.domain})`);
        console.log(`   ID: ${tenant.id}`);
        console.log(`   Status: ${tenant.status}`);
        console.log(`   Roles: ${tenant._count.roles}, Users: ${tenant._count.users}\n`);
      });
    }

    // 2. Check all roles and their tenant associations
    console.log('🛡️  ROLES:');
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        tenantId: true,
        isDefault: true,
        isRemovable: true,
        tenant: {
          select: {
            name: true,
            domain: true
          }
        },
        _count: {
          select: {
            userRoles: true,
            rolePermissions: true
          }
        }
      },
      orderBy: [
        { tenantId: { sort: 'asc', nulls: 'first' } },
        { name: 'asc' }
      ]
    });

    if (roles.length === 0) {
      console.log('❌ No roles found.');
    } else {
      // Group roles by tenant
      const globalRoles = roles.filter(role => !role.tenantId);
      const tenantRoles = roles.filter(role => role.tenantId);

      if (globalRoles.length > 0) {
        console.log('   🌐 GLOBAL ROLES (No Tenant):');
        globalRoles.forEach(role => {
          console.log(`      - ${role.name}: ${role.description || 'No description'}`);
          console.log(`        ID: ${role.id}`);
          console.log(`        Users: ${role._count.userRoles}, Permissions: ${role._count.rolePermissions}`);
          console.log(`        Default: ${role.isDefault}, Removable: ${role.isRemovable}\n`);
        });
      }

      if (tenantRoles.length > 0) {
        console.log('   🏢 TENANT-SPECIFIC ROLES:');
        tenantRoles.forEach(role => {
          console.log(`      - ${role.name}: ${role.description || 'No description'}`);
          console.log(`        ID: ${role.id}`);
          console.log(`        Tenant: ${role.tenant?.name || 'Unknown'} (${role.tenant?.domain || 'N/A'})`);
          console.log(`        Tenant ID: ${role.tenantId}`);
          console.log(`        Users: ${role._count.userRoles}, Permissions: ${role._count.rolePermissions}`);
          console.log(`        Default: ${role.isDefault}, Removable: ${role.isRemovable}\n`);
        });
      }
    }

    // 3. Check permissions
    console.log('🔑 PERMISSIONS:');
    const permissions = await prisma.permission.findMany({
      select: {
        id: true,
        module: true,
        action: true,
        description: true,
        _count: {
          select: {
            rolePermissions: true
          }
        }
      }
    });

    if (permissions.length === 0) {
      console.log('❌ No permissions found.');
    } else {
      console.log(`   Found ${permissions.length} permissions:`);
      permissions.forEach(permission => {
        console.log(`      - ${permission.module}.${permission.action}: ${permission.description || 'No description'}`);
        console.log(`        Used in ${permission._count.rolePermissions} role assignments\n`);
      });
    }

    // 4. Security check - look for cross-tenant contamination
    console.log('🚨 SECURITY VALIDATION:');
    
    // Check if any roles are shared between tenants (should not happen)
    const duplicateRoleNames = await prisma.role.groupBy({
      by: ['name'],
      _count: { name: true },
      having: {
        name: { _count: { gt: 1 } }
      }
    });

    if (duplicateRoleNames.length > 0) {
      console.log('⚠️  WARNING: Duplicate role names found (could indicate contamination):');
      for (const duplicate of duplicateRoleNames) {
        const rolesWithSameName = await prisma.role.findMany({
          where: { name: duplicate.name },
          include: { tenant: true }
        });
        
        console.log(`   Role "${duplicate.name}" exists ${duplicate._count.name} times:`);
        rolesWithSameName.forEach(role => {
          console.log(`     - Tenant: ${role.tenant?.name || 'GLOBAL'} (ID: ${role.tenantId || 'NULL'})`);
        });
      }
    } else {
      console.log('✅ No duplicate role names across tenants - isolation looks good!');
    }

    console.log('\n📝 RECOMMENDATIONS:');
    console.log('   1. Global roles (tenantId=NULL) should only be system-level roles');
    console.log('   2. Each tenant should have its own copy of standard roles (HOD, STAFF, etc.)');
    console.log('   3. Role names can be the same across tenants but must be isolated by tenantId');
    console.log('   4. When creating users, always validate that roles belong to the same tenant');

  } catch (error) {
    console.error('❌ Error checking role isolation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRoleTenantIsolation().catch(console.error);
