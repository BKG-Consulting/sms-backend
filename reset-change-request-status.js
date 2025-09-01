const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetChangeRequestStatus() {
  try {
    console.log('🔄 Resetting Change Request Status...');
    
    // The change request ID from your logs
    const changeRequestId = '9b0ffe41-89fc-42a6-a5f1-8f2a90d254db';
    
    console.log(`\n📋 Change Request ID: ${changeRequestId}`);
    
    // 1. Get the current change request
    console.log('\n🔍 Getting current change request...');
    
    const changeRequest = await prisma.documentChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        approvals: {
          include: {
            approvedBy: true,
            role: true
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    if (!changeRequest) {
      console.log('❌ Change request not found');
      return;
    }
    
    console.log(`✅ Found change request:`);
    console.log(`   - Status: ${changeRequest.status}`);
    console.log(`   - Document: ${changeRequest.documentId}`);
    console.log(`   - Clause: ${changeRequest.clauseNumber}`);
    console.log(`   - Requested by: ${changeRequest.requestedBy?.firstName} ${changeRequest.requestedBy?.lastName}`);
    console.log(`   - Approvals: ${changeRequest.approvals?.length || 0}`);
    
    if (changeRequest.approvals && changeRequest.approvals.length > 0) {
      console.log('\n📋 Current approvals:');
      changeRequest.approvals.forEach((approval, index) => {
        console.log(`   ${index + 1}. ${approval.approvedBy?.firstName} ${approval.approvedBy?.lastName} (${approval.role?.name}) - ${approval.status}`);
      });
    }
    
    // 2. Reset the status to UNDER_REVIEW
    console.log('\n🔄 Resetting status to UNDER_REVIEW...');
    
    const updatedChangeRequest = await prisma.documentChangeRequest.update({
      where: { id: changeRequestId },
      data: {
        status: 'UNDER_REVIEW',
        updatedAt: new Date()
      },
      include: {
        approvals: true
      }
    });
    
    console.log(`✅ Status updated to: ${updatedChangeRequest.status}`);
    
    // 3. Optionally, you can also clear the approvals if you want a completely fresh start
    console.log('\n🗑️  Clearing existing approvals...');
    
    if (changeRequest.approvals && changeRequest.approvals.length > 0) {
      await prisma.documentApproval.deleteMany({
        where: {
          changeRequestId: changeRequestId
        }
      });
      
      console.log(`✅ Cleared ${changeRequest.approvals.length} approvals`);
    } else {
      console.log('⏭️  No approvals to clear');
    }
    
    // 4. Verify the final state
    console.log('\n🔍 Verifying final state...');
    
    const finalChangeRequest = await prisma.documentChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        approvals: true
      }
    });
    
    console.log(`✅ Final status: ${finalChangeRequest.status}`);
    console.log(`✅ Approvals count: ${finalChangeRequest.approvals?.length || 0}`);
    
    console.log('\n🎉 Change request reset completed!');
    console.log('\n📊 Summary:');
    console.log(`   - Change request ID: ${changeRequestId}`);
    console.log(`   - Status reset to: UNDER_REVIEW`);
    console.log(`   - Approvals cleared: ${changeRequest.approvals?.length || 0}`);
    
    console.log('\n🔍 Next steps:');
    console.log('   1. Go to the change request page');
    console.log('   2. Approve the change request again');
    console.log('   3. MR user should now receive the notification');
    console.log('   4. Check server logs for notification success');

  } catch (error) {
    console.error('❌ Error resetting change request status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
resetChangeRequestStatus(); 