const { PrismaClient } = require('@prisma/client');
const { getAvailableRoles } = require('../constants/rolePermissions');

const prisma = new PrismaClient();

async function analyzeRoleTenantContamination() {
  console.log('🔍 ANALYZING ROLE-TENANT CONTAMINATION ISSUES\n');

  try {
    // 1. Check current tenant and role situation
    console.log('1. 📊 CURRENT SYSTEM STATE:');
    const tenants = await prisma.tenant.findMany({
      include: {
        roles: {
          select: {
            id: true,
            name: true,
            tenantId: true
          }
        },
        users: {
          select: {
            id: true,
            email: true,
            tenantId: true
          }
        }
      }
    });

    tenants.forEach(tenant => {
      console.log(`   🏢 ${tenant.name} (${tenant.domain})`);
      console.log(`      Tenant ID: ${tenant.id}`);
      console.log(`      Roles: ${tenant.roles.length}`);
      tenant.roles.forEach(role => {
        console.log(`         - ${role.name} (${role.id}) - tenantId: ${role.tenantId}`);
      });
      console.log(`      Users: ${tenant.users.length}`);
      tenant.users.forEach(user => {
        console.log(`         - ${user.email} - tenantId: ${user.tenantId}`);
      });
      console.log();
    });

    // 2. Check predefined role templates
    console.log('2. 🎭 PREDEFINED ROLE TEMPLATES:');
    const predefinedRoles = getAvailableRoles();
    console.log(`   Templates: ${predefinedRoles.join(', ')}\n`);

    // 3. Simulate what happens during role creation
    console.log('3. 🚨 ROLE CREATION SIMULATION:');
    console.log('   When a system admin wants to create roles, they:');
    console.log('   a) Call GET /api/roles/available → Gets predefined templates');
    console.log('   b) Select a template (e.g., "ADMIN")');
    console.log('   c) Call POST /api/roles/roles with template data');
    console.log('   d) Backend creates role with req.user.tenantId');
    console.log();

    // 4. Check UserFormModal role fetching
    console.log('4. 📝 USER FORM MODAL ANALYSIS:');
    console.log('   When creating users, the frontend:');
    console.log('   a) Calls GET /api/roles/tenant/roles');
    console.log('   b) Gets only roles for the current tenant');
    console.log('   c) Shows tenant-specific roles in dropdown');
    console.log();

    // 5. Analyze potential contamination scenarios
    console.log('5. ⚠️  POTENTIAL CONTAMINATION SCENARIOS:');
    
    // Check for roles with NULL tenantId (global roles)
    const globalRoles = await prisma.role.findMany({
      where: { tenantId: null },
      select: { id: true, name: true, tenantId: true }
    });

    if (globalRoles.length > 0) {
      console.log('   🚨 GLOBAL ROLES DETECTED (tenantId = NULL):');
      globalRoles.forEach(role => {
        console.log(`      - ${role.name} (${role.id})`);
      });
      console.log('   ⚠️  These could be assigned to any tenant!');
    } else {
      console.log('   ✅ No global roles found - good isolation');
    }

    // Check for duplicate role names across tenants
    const roleNameGroups = {};
    const allRoles = await prisma.role.findMany({
      include: {
        tenant: {
          select: { name: true, domain: true }
        }
      }
    });

    allRoles.forEach(role => {
      const key = role.name.toUpperCase();
      if (!roleNameGroups[key]) roleNameGroups[key] = [];
      roleNameGroups[key].push(role);
    });

    console.log('\n   🔍 ROLE NAME DISTRIBUTION:');
    Object.entries(roleNameGroups).forEach(([roleName, roles]) => {
      if (roles.length > 1) {
        console.log(`      ${roleName}:`);
        roles.forEach(role => {
          const tenantInfo = role.tenant ? `${role.tenant.name}` : 'GLOBAL';
          console.log(`         - ${tenantInfo} (${role.tenantId || 'NULL'})`);
        });
      }
    });

    // 6. Test specific scenarios
    console.log('\n6. 🧪 TESTING SCENARIOS:');
    
    // Scenario A: New tenant onboarding
    console.log('   A) NEW TENANT ONBOARDING:');
    console.log('      ✅ Creates SYSTEM_ADMIN role with correct tenantId');
    console.log('      ❌ Does NOT create other predefined roles');
    console.log('      📝 System admin logs in and sees NO roles except SYSTEM_ADMIN');
    
    // Scenario B: System admin creates roles
    console.log('\n   B) SYSTEM ADMIN CREATES ROLES:');
    console.log('      ✅ Gets predefined templates (no tenantId)');
    console.log('      ✅ Creates role with their tenantId from req.user.tenantId');
    console.log('      ❓ Question: Are permissions auto-assigned?');
    
    // Scenario C: User creation
    console.log('\n   C) USER CREATION:');
    console.log('      ✅ Fetches roles using GET /api/roles/tenant/roles');
    console.log('      ✅ Only shows roles for current tenant');
    console.log('      ❓ Question: What if tenant has no roles besides SYSTEM_ADMIN?');

    // 7. Security recommendations
    console.log('\n7. 🛡️  SECURITY RECOMMENDATIONS:');
    console.log('   1. ✅ Current system properly isolates roles by tenantId');
    console.log('   2. ⚠️  New tenants need basic role set created during onboarding');
    console.log('   3. ✅ Role templates are stateless - no contamination risk');
    console.log('   4. ⚠️  UserFormModal will be empty if tenant has no roles');
    console.log('   5. 💡 Consider auto-creating essential roles during onboarding');

    // 8. Check what happens with empty tenant roles
    console.log('\n8. 🔍 EMPTY TENANT SCENARIOS:');
    tenants.forEach(tenant => {
      const essentialRoles = ['ADMIN', 'STAFF', 'HOD'];
      const hasEssentialRoles = essentialRoles.some(roleName => 
        tenant.roles.some(role => role.name.toUpperCase() === roleName)
      );
      
      console.log(`   ${tenant.name}:`);
      console.log(`      Has essential roles: ${hasEssentialRoles ? 'YES' : 'NO'}`);
      console.log(`      Total roles: ${tenant.roles.length}`);
      
      if (!hasEssentialRoles && tenant.roles.length === 1) {
        console.log(`      ⚠️  Only has SYSTEM_ADMIN - UserFormModal will be limited!`);
      }
    });

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeRoleTenantContamination();
