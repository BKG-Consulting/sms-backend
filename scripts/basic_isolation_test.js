/**
 * SIMPLIFIED TENANT ISOLATION TEST
 * Quick verification of tenant isolation without complex setup
 */

const { prisma } = require('../prisma/client');

async function runBasicIsolationTest() {
  try {
    console.log('🔒 BASIC TENANT ISOLATION TEST');
    console.log('='.repeat(50));
    
    // Test 1: Check if we can query existing tenants
    console.log('\n📊 Checking existing tenants...');
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true },
      take: 5
    });
    console.log(`Found ${tenants.length} tenants:`, tenants.map(t => `${t.name} (${t.id})`));
    
    // Test 2: Check role-tenant relationships
    console.log('\n🎭 Checking role-tenant relationships...');
    const roles = await prisma.role.findMany({
      select: { id: true, name: true, tenantId: true },
      take: 10
    });
    console.log(`Found ${roles.length} roles across tenants`);
    
    // Group by tenant
    const rolesByTenant = roles.reduce((acc, role) => {
      if (!acc[role.tenantId]) acc[role.tenantId] = [];
      acc[role.tenantId].push(role.name);
      return acc;
    }, {});
    
    console.log('Roles by tenant:');
    Object.entries(rolesByTenant).forEach(([tenantId, roleNames]) => {
      console.log(`  ${tenantId}: ${roleNames.join(', ')}`);
    });
    
    // Test 3: Check for potential cross-tenant contamination
    console.log('\n🔍 Checking for cross-tenant contamination...');
    const crossTenantIssues = await prisma.$queryRaw`
      SELECT 
        u.id as user_id,
        u.email,
        u."tenantId" as user_tenant,
        r.id as role_id,
        r.name as role_name,
        r."tenantId" as role_tenant
      FROM "User" u
      JOIN "UserRole" ur ON u.id = ur."userId"
      JOIN "Role" r ON ur."roleId" = r.id
      WHERE u."tenantId" != r."tenantId"
      LIMIT 10
    `;
    
    if (crossTenantIssues.length === 0) {
      console.log('✅ No cross-tenant contamination detected in UserRole table');
    } else {
      console.log(`❌ Found ${crossTenantIssues.length} cross-tenant contamination issues:`);
      crossTenantIssues.forEach(issue => {
        console.log(`  User ${issue.email} (${issue.user_tenant}) has role ${issue.role_name} (${issue.role_tenant})`);
      });
    }
    
    // Test 4: Check department roles
    console.log('\n🏢 Checking department role isolation...');
    const deptCrossTenantIssues = await prisma.$queryRaw`
      SELECT 
        u.id as user_id,
        u.email,
        u."tenantId" as user_tenant,
        r.name as role_name,
        r."tenantId" as role_tenant,
        d.name as dept_name,
        d."tenantId" as dept_tenant
      FROM "User" u
      JOIN "UserDepartmentRole" udr ON u.id = udr."userId"
      JOIN "Role" r ON udr."roleId" = r.id
      JOIN "Department" d ON udr."departmentId" = d.id
      WHERE u."tenantId" != r."tenantId" OR u."tenantId" != d."tenantId"
      LIMIT 10
    `;
    
    if (deptCrossTenantIssues.length === 0) {
      console.log('✅ No cross-tenant contamination in UserDepartmentRole table');
    } else {
      console.log(`❌ Found ${deptCrossTenantIssues.length} department cross-tenant issues:`);
      deptCrossTenantIssues.forEach(issue => {
        console.log(`  User ${issue.email} (${issue.user_tenant}) has dept role ${issue.role_name} (${issue.role_tenant})`);
      });
    }
    
    // Test 5: Verify tenant role name consistency
    console.log('\n🔧 Checking role name consistency across tenants...');
    const roleNameAnalysis = await prisma.role.groupBy({
      by: ['name'],
      _count: { name: true },
      having: { name: { _count: { gt: 1 } } }
    });
    
    console.log(`Found ${roleNameAnalysis.length} role names used across multiple tenants:`);
    for (const analysis of roleNameAnalysis) {
      const rolesWithSameName = await prisma.role.findMany({
        where: { name: analysis.name },
        select: { id: true, tenantId: true, name: true }
      });
      console.log(`  "${analysis.name}" appears in ${analysis._count.name} tenants:`, 
        rolesWithSameName.map(r => r.tenantId).join(', '));
    }
    
    console.log('\n🎉 Basic tenant isolation check complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
runBasicIsolationTest();
