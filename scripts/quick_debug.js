const { PrismaClient } = require('@prisma/client');

async function quickDebug() {
  const prisma = new PrismaClient();
  
  try {
    const tenantId = '5070bae6-2e42-491f-8ff0-ae87b9765c2a';
    
    console.log('🔍 Quick debug of Principal notification issue');
    
    // Check if PRINCIPAL role exists
    const principalRole = await prisma.role.findFirst({
      where: {
        name: 'PRINCIPAL',
        tenantId
      }
    });
    
    if (!principalRole) {
      console.log('❌ No PRINCIPAL role found for tenant');
      process.exit(0);
    }
    
    console.log(`✅ PRINCIPAL role found: ${principalRole.id}`);
    
    // Current buggy implementation
    const currentImpl = await prisma.user.findMany({
      where: {
        tenantId,
        userDepartmentRoles: { some: { roleId: principalRole.id } }
      }
    });
    
    // Correct implementation
    const correctImpl = await prisma.user.findMany({
      where: {
        tenantId,
        OR: [
          { userRoles: { some: { roleId: principalRole.id } } },
          { userDepartmentRoles: { some: { roleId: principalRole.id } } }
        ]
      }
    });
    
    console.log(`Current implementation finds: ${currentImpl.length} users`);
    console.log(`Correct implementation finds: ${correctImpl.length} users`);
    
    if (currentImpl.length === 0 && correctImpl.length > 0) {
      console.log('❌ BUG CONFIRMED: Principal users are assigned via userRoles, not userDepartmentRoles');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

quickDebug();
