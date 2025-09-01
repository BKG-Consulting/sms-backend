const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupManagementReviewAttendance() {
  try {
    console.log('🧹 Starting cleanup of Management Review meeting attendance records...');
    
    // Find all management review meetings
    const managementReviewMeetings = await prisma.auditPlanningMeeting.findMany({
      where: {
        type: 'MANAGEMENT_REVIEW'
      },
      include: {
        attendances: true
      }
    });
    
    console.log(`📊 Found ${managementReviewMeetings.length} Management Review meetings`);
    
    let totalAttendanceRecords = 0;
    let deletedRecords = 0;
    
    for (const meeting of managementReviewMeetings) {
      console.log(`\n🔍 Processing meeting: ${meeting.id}`);
      console.log(`   - Status: ${meeting.status}`);
      console.log(`   - Attendance records: ${meeting.attendances.length}`);
      
      totalAttendanceRecords += meeting.attendances.length;
      
      if (meeting.attendances.length > 0) {
        // Delete all attendance records for this meeting
        const deleteResult = await prisma.auditPlanningAttendance.deleteMany({
          where: {
            meetingId: meeting.id
          }
        });
        
        deletedRecords += deleteResult.count;
        console.log(`   ✅ Deleted ${deleteResult.count} attendance records`);
      }
    }
    
    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   - Total Management Review meetings: ${managementReviewMeetings.length}`);
    console.log(`   - Total attendance records found: ${totalAttendanceRecords}`);
    console.log(`   - Total attendance records deleted: ${deletedRecords}`);
    
    console.log('\n✅ Cleanup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the cleanup
cleanupManagementReviewAttendance(); 