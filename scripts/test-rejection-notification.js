const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRejectionNotification() {
  try {
    console.log('🧪 Testing rejection notification workflow...');
    
    // Find an AUDIT_REPORT document that's currently UNDER_REVIEW
    const auditReport = await prisma.document.findFirst({
      where: {
        type: 'AUDIT_REPORT',
        status: 'UNDER_REVIEW'
      },
      include: {
        owner: true,
        currentVersion: true
      }
    });
    
    if (!auditReport) {
      console.log('❌ No AUDIT_REPORT document found with UNDER_REVIEW status');
      console.log('   Please submit an audit report for approval first');
      return;
    }
    
    console.log(`📄 Found audit report: "${auditReport.title}"`);
    console.log(`   Owner: ${auditReport.owner?.firstName} ${auditReport.owner?.lastName} (${auditReport.owner?.email})`);
    console.log(`   Status: ${auditReport.status}`);
    console.log(`   Document ID: ${auditReport.id}`);
    
    // Find an MR user to simulate the rejection
    const mrUser = await prisma.user.findFirst({
      where: {
        userDepartmentRoles: {
          some: {
            role: {
              name: 'MR'
            }
          }
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    });
    
    if (!mrUser) {
      console.log('❌ No MR user found');
      return;
    }
    
    console.log(`👤 Found MR user: ${mrUser.firstName} ${mrUser.lastName} (${mrUser.email})`);
    
    // Simulate the rejection by calling the rejectDocument function
    const documentService = require('../src/services/documentService');
    
    console.log('\n🔄 Simulating rejection...');
    const result = await documentService.rejectDocument({
      documentId: auditReport.id,
      userId: mrUser.id,
      tenantId: auditReport.tenantId,
      userRole: 'MR',
      comment: 'Test rejection - please review and resubmit with corrections'
    });
    
    console.log('\n✅ Rejection completed successfully!');
    console.log(`   New status: ${result.status}`);
    
    // Check if notification was created
    const notification = await prisma.notification.findFirst({
      where: {
        documentId: auditReport.id,
        type: 'DOCUMENT_REJECTION',
        targetUserId: auditReport.ownerId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (notification) {
      console.log('\n📢 Notification created successfully!');
      console.log(`   Notification ID: ${notification.id}`);
      console.log(`   Type: ${notification.type}`);
      console.log(`   Title: ${notification.title}`);
      console.log(`   Message: ${notification.message}`);
      console.log(`   Target User: ${auditReport.owner?.email}`);
      console.log(`   Created: ${notification.createdAt}`);
    } else {
      console.log('\n❌ No notification found!');
    }
    
    // Check the updated document
    const updatedDocument = await prisma.document.findUnique({
      where: { id: auditReport.id },
      include: { owner: true }
    });
    
    console.log('\n📋 Document status after rejection:');
    console.log(`   Status: ${updatedDocument.status}`);
    console.log(`   Updated at: ${updatedDocument.updatedAt}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testRejectionNotification(); 