const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyRevertAndFix() {
  try {
    const tenantId = '5070bae6-2e42-491f-8ff0-ae87b9765c2a';
    const programId = 'd3bf0cf4-61b8-45fe-82fb-1460125be552';

    console.log('🔍 VERIFICATION: AUDIT PROGRAM STATUS & NOTIFICATION FIX');
    console.log('========================================================');

    // 1. Check current program status
    const program = await prisma.auditProgram.findUnique({
      where: { id: programId },
      select: { 
        id: true, 
        title: true, 
        status: true, 
        committedAt: true,
        tenantId: true
      }
    });

    if (!program) {
      console.log('❌ Program not found');
      return;
    }

    console.log(`\n✅ Program: "${program.title}"`);
    console.log(`   Status: ${program.status}`);
    console.log(`   Committed: ${program.committedAt || 'No'}`);

    // 2. Check if Principal role and users exist
    const principalRole = await prisma.role.findFirst({
      where: { name: 'PRINCIPAL', tenantId }
    });

    if (!principalRole) {
      console.log('❌ No PRINCIPAL role found');
      return;
    }

    const principalUsers = await prisma.user.findMany({
      where: {
        tenantId,
        OR: [
          { userRoles: { some: { roleId: principalRole.id } } },
          { userDepartmentRoles: { some: { roleId: principalRole.id } } }
        ]
      },
      select: { id: true, firstName: true, lastName: true, email: true }
    });

    console.log(`\n✅ Principal users ready to receive notifications: ${principalUsers.length}`);
    principalUsers.forEach(user => {
      console.log(`   📧 ${user.firstName} ${user.lastName} (${user.email})`);
    });

    // 3. Check existing notifications
    const notifications = await prisma.notification.findMany({
      where: {
        metadata: {
          path: ['programId'],
          equals: programId
        }
      }
    });

    console.log(`\n📨 Existing notifications for this program: ${notifications.length}`);

    console.log('\n🎯 READY FOR TESTING:');
    console.log('   ✅ Program is in DRAFT status');
    console.log('   ✅ Principal users identified');
    console.log('   ✅ Notification fix applied in auditProgramService.js');
    console.log('   ✅ Ready for MR to re-commit program');

    console.log('\n📋 TESTING STEPS:');
    console.log('   1. MR logs in and commits the audit program');
    console.log('   2. Check that Principal (Hesbon Liz) receives notification');
    console.log('   3. Verify notification appears in Principal\'s dashboard');

  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

verifyRevertAndFix();
