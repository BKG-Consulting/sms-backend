const { prisma } = require('../prisma/client');

async function testUsersQuery() {
  try {
    const tenantId = '41c43613-2e6a-4b0e-bf72-0ce6ca12599e';
    const workingTenantId = '8be26a37-b3a6-42e1-8a9b-3008ca5e1d56';
    
    // Test basic user query
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        verified: true,
        tenantId: true
      }
    });
    
    console.log('Users found:', users.length);
    console.log('Users:', JSON.stringify(users, null, 2));
    
    // Test the full query from the service
    const fullUsers = await prisma.user.findMany({
      where: { tenantId },
      include: {
        userRoles: { include: { role: true } },
        userDepartmentRoles: {
          include: {
            department: true,
            role: true,
          }
        },
      },
      orderBy: { firstName: 'asc' },
    });
    
    console.log('\nFull users found:', fullUsers.length);
    console.log('Full users:', JSON.stringify(fullUsers, null, 2));
    
    // Test with the working tenant ID
    console.log('\n=== Testing with working tenant ID ===');
    const workingUsers = await prisma.user.findMany({
      where: { tenantId: workingTenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        verified: true,
        tenantId: true
      }
    });
    
    console.log('Working tenant users found:', workingUsers.length);
    console.log('Working tenant users:', JSON.stringify(workingUsers.slice(0, 3), null, 2)); // Show first 3 users
    
  } catch (error) {
    console.error('Error testing users query:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUsersQuery();
