const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPrincipalNotificationFix() {
  try {
    const tenantId = '5070bae6-2e42-491f-8ff0-ae87b9765c2a';

    console.log('🧪 TESTING PRINCIPAL NOTIFICATION FIX');
    console.log('====================================');
    console.log(`Tenant ID: ${tenantId}`);

    // 1. Find PRINCIPAL role for this tenant
    const principalRole = await prisma.role.findFirst({
      where: {
        name: 'PRINCIPAL',
        tenantId
      }
    });

    if (!principalRole) {
      console.log('❌ PRINCIPAL role not found for this tenant');
      return;
    }

    console.log(`✅ PRINCIPAL role found: ${principalRole.id}`);

    // 2. Test the FIXED implementation (using OR condition)
    console.log('\n🔧 Testing FIXED implementation (with OR condition)...');
    const principalUsers = await prisma.user.findMany({
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

    console.log(`Found ${principalUsers.length} Principal users:`);
    principalUsers.forEach(user => {
      console.log(`   ✅ ${user.firstName} ${user.lastName} (${user.email})`);
      console.log(`      Global roles: ${user.userRoles.length}`);
      console.log(`      Department roles: ${user.userDepartmentRoles.length}`);
    });

    if (principalUsers.length > 0) {
      console.log('\n🎉 SUCCESS: Principal users will now be found and notified!');
      
      // 3. Simulate notification creation
      console.log('\n📨 Simulating notification creation...');
      const notificationsData = principalUsers.map(principalUser => ({
        type: 'AUDIT_PROGRAM_APPROVAL',
        title: 'Audit Program Pending Approval',
        message: `New audit program "Test Program" requires your approval.`,
        tenantId,
        targetUserId: principalUser.id,
        link: `/audits/test-program-id`,
        metadata: {
          programId: 'test-program-id',
          programTitle: 'Test Program',
          createdBy: 'test-user'
        }
      }));

      console.log(`Would create ${notificationsData.length} notifications:`);
      notificationsData.forEach((notif, index) => {
        const user = principalUsers[index];
        console.log(`   📧 To: ${user.firstName} ${user.lastName} (${user.email})`);
        console.log(`      Title: ${notif.title}`);
        console.log(`      Message: ${notif.message}`);
      });
    } else {
      console.log('\n❌ No Principal users found - notifications will not be sent');
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing principal notification fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrincipalNotificationFix();
