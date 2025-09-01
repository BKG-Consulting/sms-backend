const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function revertAuditProgramToDraft() {
  try {
    const tenantId = '5070bae6-2e42-491f-8ff0-ae87b9765c2a';
    const programId = 'd3bf0cf4-61b8-45fe-82fb-1460125be552';

    console.log('🔄 REVERTING AUDIT PROGRAM TO DRAFT');
    console.log('===================================');
    console.log(`Tenant ID: ${tenantId}`);
    console.log(`Program ID: ${programId}`);

    // 1. Check current status
    console.log('\n1. Checking current audit program status...');
    const currentProgram = await prisma.auditProgram.findFirst({
      where: {
        id: programId,
        tenantId
      },
      include: {
        audits: { select: { id: true, type: true } }
      }
    });

    if (!currentProgram) {
      console.log('❌ Audit program not found');
      return;
    }

    console.log(`✅ Found audit program: "${currentProgram.title}"`);
    console.log(`   Current status: ${currentProgram.status}`);
    console.log(`   Committed at: ${currentProgram.committedAt || 'Never'}`);
    console.log(`   Number of audits: ${currentProgram.audits.length}`);

    if (currentProgram.status === 'DRAFT') {
      console.log('⚠️ Program is already in DRAFT status');
      return;
    }

    // 2. Revert to DRAFT
    console.log('\n2. Reverting audit program to DRAFT status...');
    
    await prisma.$transaction(async (tx) => {
      // Update program status back to DRAFT
      await tx.auditProgram.update({
        where: { id: programId },
        data: {
          status: 'DRAFT',
          committedAt: null
        }
      });

      // Create audit log entry for the reversion
      await tx.auditLog.create({
        data: {
          action: 'REVERT_TO_DRAFT',
          entityType: 'AUDIT_PROGRAM',
          entityId: programId,
          userId: 'SYSTEM', // Since this is a system operation
          tenantId,
          details: `Reverted audit program "${currentProgram.title}" from ${currentProgram.status} back to DRAFT for testing notification fix`,
          metadata: {
            previousStatus: currentProgram.status,
            revertedAt: new Date(),
            reason: 'Testing Principal notification fix'
          }
        }
      });

      console.log('✅ Audit program successfully reverted to DRAFT');
    });

    // 3. Clean up any existing notifications for this program
    console.log('\n3. Cleaning up existing notifications...');
    const deletedNotifications = await prisma.notification.deleteMany({
      where: {
        metadata: {
          path: ['programId'],
          equals: programId
        }
      }
    });

    console.log(`🗑️ Deleted ${deletedNotifications.count} existing notifications`);

    // 4. Verify final status
    console.log('\n4. Verifying final status...');
    const updatedProgram = await prisma.auditProgram.findUnique({
      where: { id: programId },
      select: { 
        id: true, 
        title: true, 
        status: true, 
        committedAt: true 
      }
    });

    console.log(`✅ Final status: ${updatedProgram.status}`);
    console.log(`✅ Committed at: ${updatedProgram.committedAt || 'NULL (as expected)'}`);

    console.log('\n🎉 SUCCESS! Audit program has been reverted to DRAFT');
    console.log('📋 NEXT STEPS:');
    console.log('   1. MR can now re-commit the audit program');
    console.log('   2. This should trigger notification to Principal');
    console.log('   3. Verify Principal (Hesbon Liz) receives the notification');

  } catch (error) {
    console.error('❌ Error reverting audit program:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

revertAuditProgramToDraft();
