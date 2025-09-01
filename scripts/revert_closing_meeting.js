// Usage: node revert_closing_meeting.js <meetingId>
const { prisma } = require('../prisma/client');

async function revertClosingMeeting(meetingId) {
  if (!meetingId) {
    console.error('Usage: node revert_closing_meeting.js <meetingId>');
    process.exit(1);
  }
  
  try {
    const updated = await prisma.auditPlanningMeeting.update({
      where: { id: meetingId },
      data: { 
        status: 'ACTIVE',
        notes: null // Clear any completion notes
      },
    });
    
    console.log(`✅ Closing meeting ${meetingId} status reverted to ACTIVE`);
    console.log('Updated meeting:', {
      id: updated.id,
      type: updated.type,
      status: updated.status,
      updatedAt: updated.updatedAt
    });
    
  } catch (err) {
    console.error('Failed to revert closing meeting status:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
revertClosingMeeting(meetingId); 