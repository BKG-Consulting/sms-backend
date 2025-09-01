const { prisma } = require('../prisma/client');

async function investigateDuplicateHodRoles() {
  try {
    console.log('=== INVESTIGATING DUPLICATE HOD ROLES ===\n');
    
    const tenantId = '40bbcd5e-2eb9-4c18-ad83-55a96db87003';
    
    // 1. Find ALL roles with HOD-related names for this tenant
    const allHodRoles = await prisma.role.findMany({
      where: {
        tenantId,
        OR: [
          { name: { contains: 'HOD', mode: 'insensitive' } },
          { name: { contains: 'head', mode: 'insensitive' } }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log('✅ Found HOD-related roles for tenant:');
    allHodRoles.forEach((role, index) => {
      console.log(`  ${index + 1}. ${role.name} (ID: ${role.id}) - Created: ${role.createdAt}`);
    });

    // 2. Find Wilson's specific role
    const wilsonRole = await prisma.role.findUnique({
      where: { id: '5060936b-d7ed-4c13-85c5-117d9c4d7236' }
    });

    console.log('\n=== Wilson\'s Role Details ===');
    if (wilsonRole) {
      console.log('Wilson\'s Role:', {
        id: wilsonRole.id,
        name: wilsonRole.name,
        description: wilsonRole.description,
        tenantId: wilsonRole.tenantId,
        createdAt: wilsonRole.createdAt
      });
    } else {
      console.log('❌ Wilson\'s role not found');
    }

    // 3. Check how many users have each HOD role
    console.log('\n=== HOD Role Usage Analysis ===');
    for (const role of allHodRoles) {
      const userCount = await prisma.userDepartmentRole.count({
        where: { roleId: role.id }
      });
      
      const users = await prisma.userDepartmentRole.findMany({
        where: { roleId: role.id },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          department: { select: { name: true } }
        }
      });

      console.log(`\nRole: ${role.name} (${role.id})`);
      console.log(`  Users with this role: ${userCount}`);
      users.forEach(u => {
        console.log(`    - ${u.user.firstName} ${u.user.lastName} (${u.user.email}) in ${u.department?.name || 'No Department'}`);
      });
    }

    // 4. Check which role is returned by getHodRolesForTenant function
    console.log('\n=== getHodRolesForTenant Function Test ===');
    
    // Simulate the function
    let hodRoles = await prisma.role.findMany({
      where: {
        tenantId,
        name: { in: ['HOD', 'HOD AUDITOR'] }
      }
    });

    console.log('getHodRolesForTenant would return:', hodRoles.map(r => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt
    })));

    // 5. The problem: Multiple HOD roles with same name
    const duplicateHodRoles = allHodRoles.filter(r => r.name === 'HOD');
    if (duplicateHodRoles.length > 1) {
      console.log('\n🚨 DUPLICATE HOD ROLES DETECTED:');
      duplicateHodRoles.forEach((role, index) => {
        console.log(`  ${index + 1}. ID: ${role.id}, Created: ${role.createdAt}`);
      });
      
      console.log('\n💡 SOLUTION NEEDED:');
      console.log('  1. Delete duplicate HOD roles');
      console.log('  2. Update Wilson to use the correct HOD role');
      console.log('  3. Ensure getHodRolesForTenant returns the right role');
    }

    // 6. Check which HOD role was created first (should be the correct one)
    const oldestHodRole = duplicateHodRoles.reduce((oldest, current) => 
      current.createdAt < oldest.createdAt ? current : oldest
    );
    
    if (oldestHodRole) {
      console.log('\n🎯 RECOMMENDED ACTION:');
      console.log(`  Keep: ${oldestHodRole.name} (${oldestHodRole.id}) - Created: ${oldestHodRole.createdAt}`);
      console.log('  Delete: All other HOD roles');
      console.log(`  Update Wilson's role from ${wilsonRole?.id} to ${oldestHodRole.id}`);
    }

  } catch (error) {
    console.error('Error during investigation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateDuplicateHodRoles();
