const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugPrincipalNotification() {
  try {
    const tenantId = '5070bae6-2e42-491f-8ff0-ae87b9765c2a';
    const programId = 'd3bf0cf4-61b8-45fe-82fb-1460125be552';

    console.log('🔍 DEBUGGING PRINCIPAL NOTIFICATION ISSUE');
    console.log('==========================================');
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Program ID: ${programId}`);

    // 1. Check if PRINCIPAL role exists for this tenant
    console.log('\n1. Checking PRINCIPAL role for tenant...');
    const principalRole = await prisma.role.findFirst({
      where: {
        name: 'PRINCIPAL',
        tenantId
      },
      include: {
        tenant: { select: { name: true, domain: true } }
      }
    });

    if (!principalRole) {
      console.log('❌ PRINCIPAL role NOT found for this tenant');
      
      // Check what roles exist for this tenant
      console.log('\n🔍 Checking all roles for this tenant...');
      const allRoles = await prisma.role.findMany({
        where: { tenantId },
        select: { id: true, name: true, description: true }
      });
      
      console.log(`Found ${allRoles.length} roles:`);
      allRoles.forEach(role => {
        console.log(`   - ${role.name}: ${role.description || 'No description'}`);
      });
      
      return;
    }

    console.log(`✅ PRINCIPAL role found: ${principalRole.id}`);
    console.log(`   Tenant: ${principalRole.tenant.name} (${principalRole.tenant.domain})`);

    // 2. Check users with PRINCIPAL role (CURRENT BUGGY IMPLEMENTATION)
    console.log('\n2. Checking users with PRINCIPAL role (current implementation - userDepartmentRoles only)...');
    const principalUsersCurrent = await prisma.user.findMany({
      where: {
        tenantId,
        userDepartmentRoles: { some: { roleId: principalRole.id } }
      },
      select: { 
        id: true, 
        email: true, 
        firstName: true, 
        lastName: true,
        userRoles: { 
          where: { roleId: principalRole.id },
          include: { role: { select: { name: true } } }
        },
        userDepartmentRoles: { 
          where: { roleId: principalRole.id },
          include: { 
            role: { select: { name: true } },
            department: { select: { name: true } }
          }
        }
      }
    });

    console.log(`Found ${principalUsersCurrent.length} Principal users (current implementation)`);
    principalUsersCurrent.forEach(user => {
      console.log(`   - ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`     Department roles: ${user.userDepartmentRoles.length}`);
      console.log(`     Global roles: ${user.userRoles.length}`);
    });

    // 3. Check users with PRINCIPAL role (CORRECT IMPLEMENTATION)
    console.log('\n3. Checking users with PRINCIPAL role (correct implementation - both userRoles and userDepartmentRoles)...');
    const principalUsersCorrect = await prisma.user.findMany({
      where: {
        tenantId,
        OR: [
          { userRoles: { some: { roleId: principalRole.id } } },
          { userDepartmentRoles: { some: { roleId: principalRole.id } } }
        ]
      },
      select: { 
        id: true, 
        email: true, 
        firstName: true, 
        lastName: true,
        userRoles: { 
          where: { roleId: principalRole.id },
          include: { role: { select: { name: true } } }
        },
        userDepartmentRoles: { 
          where: { roleId: principalRole.id },
          include: { 
            role: { select: { name: true } },
            department: { select: { name: true } }
          }
        }
      }
    });

    console.log(`Found ${principalUsersCorrect.length} Principal users (correct implementation)`);
    principalUsersCorrect.forEach(user => {
      console.log(`   - ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`     Global roles: ${user.userRoles.length}`);
      console.log(`     Department roles: ${user.userDepartmentRoles.length}`);
      user.userRoles.forEach(ur => {
        console.log(`       Global: ${ur.role.name}`);
      });
      user.userDepartmentRoles.forEach(udr => {
        console.log(`       Department: ${udr.role.name} in ${udr.department?.name || 'Unknown Dept'}`);
      });
    });

    // 4. Check notifications for this program
    console.log('\n4. Checking existing notifications for this program...');
    const notifications = await prisma.notification.findMany({
      where: {
        metadata: {
          path: ['programId'],
          equals: programId
        }
      },
      include: {
        targetUser: { select: { firstName: true, lastName: true, email: true } }
      }
    });

    console.log(`Found ${notifications.length} notifications for this program:`);
    notifications.forEach(notif => {
      console.log(`   - To: ${notif.targetUser.firstName} ${notif.targetUser.lastName} (${notif.targetUser.email})`);
      console.log(`     Type: ${notif.type}`);
      console.log(`     Title: ${notif.title}`);
      console.log(`     Created: ${notif.createdAt}`);
    });

    console.log('\n💡 ISSUE ANALYSIS:');
    if (principalUsersCurrent.length === 0 && principalUsersCorrect.length > 0) {
      console.log('❌ BUG CONFIRMED: The current implementation only checks userDepartmentRoles,');
      console.log('   but Principal users are assigned via userRoles (global roles).');
      console.log('   This is why no notifications were sent.');
      
      console.log('\n🔧 SOLUTION: Update auditProgramService.js line ~324 to use OR condition:');
      console.log('   FROM: userDepartmentRoles: { some: { roleId: principalRole.id } }');
      console.log('   TO: OR: [');
      console.log('         { userRoles: { some: { roleId: principalRole.id } } },');
      console.log('         { userDepartmentRoles: { some: { roleId: principalRole.id } } }');
      console.log('       ]');
    } else if (principalUsersCorrect.length === 0) {
      console.log('❌ NO PRINCIPAL USERS FOUND: No users have PRINCIPAL role for this tenant');
    } else {
      console.log('✅ Both implementations found the same users - issue might be elsewhere');
    }

  } catch (error) {
    console.error('❌ Error debugging principal notification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPrincipalNotification();
