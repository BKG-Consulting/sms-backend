const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceRevertToDraft() {
  try {
    const tenantId = '5070bae6-2e42-491f-8ff0-ae87b9765c2a';
    const programId = 'd3bf0cf4-61b8-45fe-82fb-1460125be552';

    console.log('🔄 FORCE REVERTING AUDIT PROGRAM TO DRAFT');
    console.log('=========================================');

    // 1. Check current status
    const currentProgram = await prisma.auditProgram.findUnique({
      where: { id: programId },
      select: { 
        id: true, 
        title: true, 
        status: true, 
        committedAt: true,
        tenantId: true
      }
    });

    if (!currentProgram) {
      console.log('❌ Program not found');
      return;
    }

    console.log(`📋 Current Program: "${currentProgram.title}"`);
    console.log(`   Status: ${currentProgram.status}`);
    console.log(`   Committed: ${currentProgram.committedAt || 'No'}`);
    console.log(`   Tenant: ${currentProgram.tenantId}`);

    if (currentProgram.status === 'DRAFT') {
      console.log('✅ Program is already in DRAFT status');
      return;
    }

    // 2. Force revert to DRAFT
    console.log('\n🔧 Force reverting to DRAFT...');
    
    await prisma.$transaction(async (tx) => {
      // Update status to DRAFT and clear committedAt
      await tx.auditProgram.update({
        where: { id: programId },
        data: {
          status: 'DRAFT',
          committedAt: null
        }
      });

      // Log the reversion
      await tx.auditLog.create({
        data: {
          action: 'FORCE_REVERT_TO_DRAFT',
          entityType: 'AUDIT_PROGRAM',
          entityId: programId,
          userId: 'SYSTEM',
          tenantId,
          details: `Force reverted audit program "${currentProgram.title}" from ${currentProgram.status} to DRAFT for notification testing`,
          metadata: {
            previousStatus: currentProgram.status,
            previousCommittedAt: currentProgram.committedAt,
            revertedAt: new Date(),
            reason: 'Testing Principal notification fix'
          }
        }
      });

      console.log('✅ Successfully reverted to DRAFT');
    });

    // 3. Clean up notifications
    console.log('\n🗑️ Cleaning up old notifications...');
    const deletedCount = await prisma.notification.deleteMany({
      where: {
        OR: [
          {
            metadata: {
              path: ['programId'],
              equals: programId
            }
          },
          {
            link: { contains: programId }
          }
        ]
      }
    });

    console.log(`   Deleted ${deletedCount.count} notifications`);

    // 4. Verify final state
    console.log('\n✅ Final verification...');
    const finalProgram = await prisma.auditProgram.findUnique({
      where: { id: programId },
      select: { 
        id: true, 
        title: true, 
        status: true, 
        committedAt: true 
      }
    });

    console.log(`   Title: "${finalProgram.title}"`);
    console.log(`   Status: ${finalProgram.status}`);
    console.log(`   Committed: ${finalProgram.committedAt || 'NULL (correct)'}`);

    console.log('\n🎉 SUCCESS! Program is now ready for testing:');
    console.log('   ✅ Status: DRAFT');
    console.log('   ✅ CommittedAt: NULL');
    console.log('   ✅ Old notifications cleaned up');
    console.log('   ✅ MR can now commit again to test the notification fix');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

forceRevertToDraft();
