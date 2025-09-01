// Usage: node scripts/check_meeting_agendas.js <meetingId>
const { prisma } = require('../prisma/client');

async function checkMeetingAgendas(meetingId) {
  if (!meetingId) {
    console.error('Usage: node scripts/check_meeting_agendas.js <meetingId>');
    process.exit(1);
  }
  try {
    const meeting = await prisma.auditPlanningMeeting.findUnique({
      where: { id: meetingId },
      include: {
        agendas: { orderBy: { order: 'asc' } }
      }
    });
    if (!meeting) {
      console.error('Meeting not found');
      process.exit(1);
    }
    if (!meeting.agendas || meeting.agendas.length === 0) {
      console.log('No agendas found for this meeting.');
    } else {
      console.log(`Agendas for meeting ${meetingId}:`);
      meeting.agendas.forEach((agenda, idx) => {
        console.log(`${idx + 1}. [${agenda.discussed ? '✔' : ' '}] ${agenda.agendaText}`);
      });
    }
  } catch (err) {
    console.error('Failed to fetch meeting agendas:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
checkMeetingAgendas(meetingId); 