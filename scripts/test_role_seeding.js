const { PrismaClient } = require('@prisma/client');
const { seedRolesForTenant } = require('../src/services/tenantRoleSeederService');

const prisma = new PrismaClient();

async function testRoleSeeding() {
  console.log('🧪 TESTING ROLE SEEDING FOR EXISTING TENANT\n');

  try {
    // Test with the existing default tenant
    const defaultTenantId = 'default-tenant';
    
    console.log('1. 📊 BEFORE - Current roles for default tenant:');
    const beforeRoles = await prisma.role.findMany({
      where: { tenantId: defaultTenantId },
      select: { id: true, name: true, description: true }
    });
    
    beforeRoles.forEach(role => {
      console.log(`   • ${role.name}: ${role.description}`);
    });
    console.log(`   Total: ${beforeRoles.length} roles\n`);

    // Run the seeding process
    console.log('2. 🌱 SEEDING - Running role seeding process...');
    const result = await seedRolesForTenant(defaultTenantId, 'test-system');
    
    console.log(`   ✅ Created: ${result.created} new roles`);
    console.log(`   ✅ Existing: ${result.existing} roles already existed`);
    console.log(`   ✅ Total: ${result.roles.length} roles now available\n`);

    console.log('3. 📊 AFTER - All roles for default tenant:');
    const afterRoles = await prisma.role.findMany({
      where: { tenantId: defaultTenantId },
      include: {
        _count: {
          select: {
            rolePermissions: true,
            userRoles: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    afterRoles.forEach(role => {
      console.log(`   • ${role.name}: ${role.description}`);
      console.log(`     ID: ${role.id}`);
      console.log(`     Permissions: ${role._count.rolePermissions}, Users: ${role._count.userRoles}\n`);
    });

    console.log('4. 🎯 VERIFICATION - Check if all predefined templates are present:');
    const { getAvailableRoles } = require('../constants/rolePermissions');
    const predefinedRoles = getAvailableRoles();
    const currentRoleNames = afterRoles.map(r => r.name.toUpperCase());
    
    const missingRoles = predefinedRoles.filter(template => 
      !currentRoleNames.includes(template)
    );
    
    const presentRoles = predefinedRoles.filter(template => 
      currentRoleNames.includes(template)
    );
    
    console.log(`   ✅ Present: ${presentRoles.join(', ')}`);
    if (missingRoles.length > 0) {
      console.log(`   ❌ Missing: ${missingRoles.join(', ')}`);
    } else {
      console.log(`   🎉 All ${predefinedRoles.length} predefined role templates are now available!`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRoleSeeding();
