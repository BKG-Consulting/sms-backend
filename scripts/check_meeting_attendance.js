// Usage: node check_meeting_attendance.js <meetingId>
const { prisma } = require('../prisma/client');

async function checkMeetingAttendance(meetingId) {
  if (!meetingId) {
    console.error('Usage: node check_meeting_attendance.js <meetingId>');
    process.exit(1);
  }
  
  try {
    const meeting = await prisma.auditPlanningMeeting.findUnique({
      where: { id: meetingId },
      include: {
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        agendas: true
      }
    });
    
    if (!meeting) {
      console.error('Meeting not found');
      process.exit(1);
    }
    
    console.log(`Meeting: ${meeting.id}`);
    console.log(`Type: ${meeting.type}`);
    console.log(`Status: ${meeting.status}`);
    console.log(`Created: ${meeting.createdAt}`);
    console.log(`\nAttendance Records: ${meeting.attendances.length}`);
    
    if (meeting.attendances.length === 0) {
      console.log('❌ No attendance records found!');
    } else {
      meeting.attendances.forEach((attendance, idx) => {
        console.log(`${idx + 1}. ${attendance.user.firstName} ${attendance.user.lastName} (${attendance.user.email}) - Present: ${attendance.present}`);
      });
    }
    
    console.log(`\nAgenda Records: ${meeting.agendas.length}`);
    if (meeting.agendas.length === 0) {
      console.log('❌ No agenda records found!');
    } else {
      meeting.agendas.forEach((agenda, idx) => {
        console.log(`${idx + 1}. [${agenda.discussed ? '✔' : ' '}] ${agenda.agendaText}`);
      });
    }
    
  } catch (err) {
    console.error('Failed to fetch meeting attendance:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const meetingId = process.argv[2];
checkMeetingAttendance(meetingId); 