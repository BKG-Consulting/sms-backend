const { prisma } = require('../prisma/client');

async function debugRoleEndpoints() {
  console.log('=== DEBUGGING ROLE ENDPOINTS ===\n');

  // Get the Titus user first to find his tenant
  const titusUser = await prisma.user.findUnique({
    where: { email: 'titus@rtvc.ac.ke' },
    include: { tenant: true }
  });

  if (!titusUser) {
    console.log('❌ Titus user not found');
    return;
  }

  console.log('📍 Titus User Details:');
  console.log(`   ID: ${titusUser.id}`);
  console.log(`   Email: ${titusUser.email}`);
  console.log(`   Tenant: ${titusUser.tenant.name} (${titusUser.tenantId})`);

  // 1. Test what getRolesByTenant returns for Titus's tenant
  console.log('\n1️⃣ TESTING: GET /api/roles/tenant/roles (tenant-scoped)');
  const tenantRoles = await prisma.role.findMany({
    where: { tenantId: titusUser.tenantId },
    select: { 
      id: true, 
      name: true, 
      description: true, 
      tenantId: true,
      createdAt: true
    },
    orderBy: { name: 'asc' }
  });
  
  console.log(`   Found ${tenantRoles.length} roles for tenant "${titusUser.tenant.name}":`);
  tenantRoles.forEach(role => {
    console.log(`   - ${role.name} (${role.id}) - ${role.description || 'No description'}`);
  });

  // 2. Test what findAllRoles returns (this might be the issue)
  console.log('\n2️⃣ TESTING: findAllRoles() - POTENTIAL CROSS-TENANT ISSUE');
  const allRoles = await prisma.role.findMany({
    select: { id: true, name: true, description: true, tenantId: true },
  });
  
  console.log(`   Found ${allRoles.length} roles ACROSS ALL TENANTS:`);
  
  // Group by tenant for clarity
  const rolesByTenant = {};
  allRoles.forEach(role => {
    if (!rolesByTenant[role.tenantId]) {
      rolesByTenant[role.tenantId] = [];
    }
    rolesByTenant[role.tenantId].push(role);
  });

  for (const [tenantId, roles] of Object.entries(rolesByTenant)) {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    console.log(`   📂 ${tenant?.name || 'Unknown Tenant'} (${tenantId}):`);
    roles.forEach(role => {
      console.log(`      - ${role.name} (${role.id})`);
    });
  }

  // 3. Check if there are duplicate role names across tenants
  console.log('\n3️⃣ CHECKING FOR DUPLICATE ROLE NAMES ACROSS TENANTS:');
  const roleNameCounts = {};
  allRoles.forEach(role => {
    if (!roleNameCounts[role.name]) {
      roleNameCounts[role.name] = [];
    }
    roleNameCounts[role.name].push({
      tenantId: role.tenantId,
      roleId: role.id
    });
  });

  const duplicateRoleNames = Object.entries(roleNameCounts).filter(([name, instances]) => instances.length > 1);
  
  if (duplicateRoleNames.length > 0) {
    console.log('   ⚠️  Found roles with same name across different tenants:');
    for (const [roleName, instances] of duplicateRoleNames) {
      console.log(`   📝 "${roleName}" exists in ${instances.length} tenants:`);
      for (const instance of instances) {
        const tenant = await prisma.tenant.findUnique({ where: { id: instance.tenantId } });
        console.log(`      - ${tenant?.name || 'Unknown'} (${instance.tenantId}) - Role ID: ${instance.roleId}`);
      }
    }
  } else {
    console.log('   ✅ No duplicate role names found across tenants');
  }

  // 4. Check specific problematic roles that might appear in dropdowns
  console.log('\n4️⃣ CHECKING PROBLEMATIC ROLES:');
  const problemRoles = ['PRINCIPAL', 'HOD', 'STAFF', 'ADMIN'];
  
  for (const roleName of problemRoles) {
    const matchingRoles = allRoles.filter(r => r.name.toUpperCase() === roleName);
    if (matchingRoles.length > 1) {
      console.log(`   🚨 "${roleName}" found in ${matchingRoles.length} tenants:`);
      for (const role of matchingRoles) {
        const tenant = await prisma.tenant.findUnique({ where: { id: role.tenantId } });
        console.log(`      - ${tenant?.name || 'Unknown'} (${role.tenantId})`);
      }
    } else if (matchingRoles.length === 1) {
      const tenant = await prisma.tenant.findUnique({ where: { id: matchingRoles[0].tenantId } });
      console.log(`   ✅ "${roleName}" only in ${tenant?.name || 'Unknown'}`);
    } else {
      console.log(`   ℹ️  "${roleName}" not found in any tenant`);
    }
  }
}

debugRoleEndpoints()
  .then(() => {
    console.log('\n=== DEBUG COMPLETE ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  });
