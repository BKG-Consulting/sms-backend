console.log('Starting test...');

const { prisma } = require('../prisma/client');

async function simpleTest() {
  try {
    console.log('Testing database connection...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Database connected:', result);
    
    // Count total users
    const totalUsers = await prisma.user.count();
    console.log('Total users in database:', totalUsers);
    
    // Check specific tenant
    const tenantId = '41c43613-2e6a-4b0e-bf72-0ce6ca12599e';
    const usersForTenant = await prisma.user.count({
      where: { tenantId }
    });
    console.log(`Users for tenant ${tenantId}:`, usersForTenant);
    
    // Get first few users for this tenant
    const users = await prisma.user.findMany({
      where: { tenantId },
      take: 5,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tenantId: true
      }
    });
    console.log('Sample users:', users);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

simpleTest();
