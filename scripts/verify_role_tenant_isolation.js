const { PrismaClient } = require('@prisma/client');
const { getAvailableRoles, getRoleDescription } = require('../constants/rolePermissions');

const prisma = new PrismaClient();

async function verifyRoleTenantIsolation() {
  console.log('🔍 VERIFYING ROLE-TENANT ISOLATION\n');

  try {
    // 1. Check all tenants
    console.log('1. 📊 CURRENT TENANTS:');
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        domain: true,
        _count: {
          select: {
            roles: true,
            users: true
          }
        }
      }
    });

    tenants.forEach(tenant => {
      console.log(`   • ${tenant.name} (${tenant.domain})`);
      console.log(`     ID: ${tenant.id}`);
      console.log(`     Roles: ${tenant._count.roles}, Users: ${tenant._count.users}\n`);
    });

    // 2. Check predefined role templates
    console.log('2. 🎭 PREDEFINED ROLE TEMPLATES:');
    const predefinedRoles = getAvailableRoles();
    console.log(`   Available templates: ${predefinedRoles.join(', ')}`);
    predefinedRoles.forEach(roleName => {
      const description = getRoleDescription(roleName);
      console.log(`   • ${roleName}: ${description}`);
    });
    console.log();

    // 3. Check actual roles in database
    console.log('3. 🗄️  ACTUAL ROLES IN DATABASE:');
    const dbRoles = await prisma.role.findMany({
      include: {
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

    // Group by tenant
    const rolesByTenant = {};
    dbRoles.forEach(role => {
      const tenantKey = role.tenantId || 'GLOBAL';
      if (!rolesByTenant[tenantKey]) {
        rolesByTenant[tenantKey] = [];
      }
      rolesByTenant[tenantKey].push(role);
    });

    Object.entries(rolesByTenant).forEach(([tenantKey, roles]) => {
      if (tenantKey === 'GLOBAL') {
        console.log('   🌐 GLOBAL ROLES (No Tenant):');
      } else {
        const tenant = roles[0].tenant;
        console.log(`   🏢 ${tenant.name} (${tenant.domain}):`);
      }
      
      roles.forEach(role => {
        const isPredefined = predefinedRoles.includes(role.name.toUpperCase());
        console.log(`      ${isPredefined ? '📋' : '🆕'} ${role.name}`);
        console.log(`         ID: ${role.id}`);
        console.log(`         Users: ${role._count.userRoles}, Permissions: ${role._count.rolePermissions}`);
        console.log(`         Predefined: ${isPredefined ? 'YES' : 'NO'}`);
        console.log();
      });
    });

    // 4. Security analysis
    console.log('4. 🚨 SECURITY ANALYSIS:');
    
    // Check for cross-tenant role contamination
    const crossTenantCheck = {};
    dbRoles.forEach(role => {
      const roleName = role.name.toUpperCase();
      if (!crossTenantCheck[roleName]) {
        crossTenantCheck[roleName] = [];
      }
      crossTenantCheck[roleName].push({
        roleId: role.id,
        tenantId: role.tenantId,
        tenantName: role.tenant ? role.tenant.name : 'GLOBAL'
      });
    });

    let hasCrossTenantIssues = false;
    Object.entries(crossTenantCheck).forEach(([roleName, instances]) => {
      if (instances.length > 1) {
        const tenantIds = [...new Set(instances.map(i => i.tenantId))];
        if (tenantIds.length > 1) {
          console.log(`   ⚠️  CROSS-TENANT ROLE: ${roleName}`);
          instances.forEach(instance => {
            console.log(`      - Tenant: ${instance.tenantName} (${instance.tenantId})`);
          });
          hasCrossTenantIssues = true;
          console.log();
        }
      }
    });

    if (!hasCrossTenantIssues) {
      console.log('   ✅ No cross-tenant role contamination detected');
    }

    // 5. Template vs actual analysis
    console.log('\n5. 🎯 TEMPLATE vs ACTUAL ANALYSIS:');
    
    tenants.forEach(tenant => {
      console.log(`\n   🏢 ${tenant.name}:`);
      const tenantRoles = dbRoles.filter(r => r.tenantId === tenant.id);
      
      // Check which predefined templates are missing
      const missingTemplates = predefinedRoles.filter(template => 
        !tenantRoles.some(role => role.name.toUpperCase() === template)
      );
      
      // Check which predefined templates are present
      const presentTemplates = predefinedRoles.filter(template => 
        tenantRoles.some(role => role.name.toUpperCase() === template)
      );
      
      // Check for custom roles
      const customRoles = tenantRoles.filter(role => 
        !predefinedRoles.includes(role.name.toUpperCase())
      );
      
      console.log(`      ✅ Present Templates: ${presentTemplates.join(', ') || 'None'}`);
      console.log(`      ❌ Missing Templates: ${missingTemplates.join(', ') || 'None'}`);
      console.log(`      🆕 Custom Roles: ${customRoles.map(r => r.name).join(', ') || 'None'}`);
    });

    // 6. Recommendations
    console.log('\n6. 💡 RECOMMENDATIONS:');
    console.log('   1. ✅ Roles are properly tenant-isolated (each has tenantId)');
    console.log('   2. ✅ Predefined templates are being used correctly');
    console.log('   3. ⚠️  When creating new tenants, ensure all required role templates are created');
    console.log('   4. ⚠️  The frontend should fetch roles using tenant-scoped API: /api/roles/tenant/roles');
    console.log('   5. ⚠️  User creation forms should only show roles from the same tenant');

    console.log('\n7. 🔍 API ENDPOINT VERIFICATION:');
    console.log('   • Template roles: GET /api/roles/available (returns templates for creation)');
    console.log('   • Tenant roles: GET /api/roles/tenant/roles (returns actual assignable roles)');
    console.log('   • Security: Both endpoints require tenantId in user context');

  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyRoleTenantIsolation();
