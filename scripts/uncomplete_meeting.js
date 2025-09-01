// Usage: node scripts/uncomplete_meeting.js <meetingId> [status]
const { prisma } = require('../prisma/client');

async function uncompleteMeeting(meetingId, status = 'ACTIVE') {
  if (!meetingId) {
    console.error('Usage: node scripts/uncomplete_meeting.js <meetingId> [status]');
    process.exit(1);
  }
  try {
    const updated = await prisma.auditPlanningMeeting.update({
      where: { id: meetingId },
      data: { status },
    });
    console.log(`Meeting ${meetingId} status updated to ${status}`);
    console.log(updated);
  } catch (err) {
    console.error('Failed to update meeting status:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
const status = process.argv[3] || 'ACTIVE';
uncompleteMeeting(meetingId, status); 