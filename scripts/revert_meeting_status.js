const { prisma } = require('../prisma/client');

async function revertMeetingStatus(meetingId, status = 'ACTIVE') {
  if (!meetingId) {
    console.error('Usage: node scripts/revert_meeting_status.js <meetingId> [status]');
    console.error('Example: node scripts/revert_meeting_status.js 37b81848-9087-48e3-a232-8da2cba4c730 ACTIVE');
    process.exit(1);
  }

  try {
    console.log(`🔄 Reverting meeting ${meetingId} status to ${status}...`);
    
    const updated = await prisma.auditPlanningMeeting.update({
      where: { id: meetingId },
      data: { status },
      include: {
        audit: {
          include: {
            auditProgram: {
              select: { title: true }
            }
          }
        },
        createdBy: {
          select: { firstName: true, lastName: true, email: true }
        }
      }
    });

    console.log(`✅ Meeting status updated successfully!`);
    console.log(`📋 Meeting Details:`);
    console.log(`   - ID: ${updated.id}`);
    console.log(`   - Type: ${updated.type}`);
    console.log(`   - Status: ${updated.status}`);
    console.log(`   - Audit Program: ${updated.audit.auditProgram.title}`);
    console.log(`   - Created By: ${updated.createdBy.firstName} ${updated.createdBy.lastName}`);
    console.log(`   - Updated At: ${updated.updatedAt}`);

  } catch (error) {
    console.error('❌ Failed to update meeting status:', error.message);
    if (error.code === 'P2025') {
      console.error('   Meeting not found with the provided ID');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line arguments
const meetingId = process.argv[2];
const status = process.argv[3] || 'ACTIVE';

revertMeetingStatus(meetingId, status); 