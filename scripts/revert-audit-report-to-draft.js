const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function revertAuditReportToDraft() {
  try {
    const targetDocumentId = 'c2967a20-485f-490b-951e-8c5d9796770c';
    
    console.log('🔄 Reverting AUDIT_REPORT document to DRAFT status...');
    console.log(`📄 Document ID: ${targetDocumentId}`);
    
    // Find the document first to verify it exists and show current status
    const document = await prisma.document.findUnique({
      where: { id: targetDocumentId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        currentVersion: { select: { id: true, version: true, createdAt: true } },
        audit: { select: { id: true, auditNo: true, type: true, status: true } }
      }
    });

    if (!document) {
      console.error('❌ Document not found!');
      return;
    }

    console.log('\n📋 Current Document Details:');
    console.log(`   Title: ${document.title}`);
    console.log(`   Type: ${document.type}`);
    console.log(`   Current Status: ${document.status}`);
    console.log(`   Owner: ${document.owner?.firstName} ${document.owner?.lastName} (${document.owner?.email})`);
    console.log(`   Audit: ${document.audit?.auditNo} - ${document.audit?.type}`);
    console.log(`   Version: ${document.currentVersion?.version}`);

    if (document.type !== 'AUDIT_REPORT') {
      console.error('❌ This is not an AUDIT_REPORT document!');
      return;
    }

    if (document.status === 'DRAFT') {
      console.log('ℹ️  Document is already in DRAFT status. No changes needed.');
      return;
    }

    // Update the document status to DRAFT
    const updatedDocument = await prisma.document.update({
      where: { id: targetDocumentId },
      data: { status: 'DRAFT' },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        currentVersion: { select: { id: true, version: true, createdAt: true } },
        audit: { select: { id: true, auditNo: true, type: true, status: true } }
      }
    });

    console.log('\n✅ Document successfully reverted to DRAFT status!');
    console.log(`   New Status: ${updatedDocument.status}`);
    console.log(`   Updated At: ${updatedDocument.updatedAt}`);

    // Also check if there are any other AUDIT_REPORT documents that might need attention
    const otherAuditReports = await prisma.document.findMany({
      where: {
        type: 'AUDIT_REPORT',
        tenantId: document.tenantId,
        id: { not: targetDocumentId }
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        audit: { select: { id: true, auditNo: true, type: true, status: true } }
      }
    });

    if (otherAuditReports.length > 0) {
      console.log('\n📊 Other AUDIT_REPORT documents in the same tenant:');
      otherAuditReports.forEach((doc, index) => {
        console.log(`   ${index + 1}. ${doc.title} (${doc.status}) - Owner: ${doc.owner?.firstName} ${doc.owner?.lastName}`);
      });
    } else {
      console.log('\n📊 No other AUDIT_REPORT documents found in this tenant.');
    }

    console.log('\n🎯 Next Steps:');
    console.log('   1. Team Leader can now click "Submit for Approval" again');
    console.log('   2. Document will go from DRAFT → UNDER_REVIEW');
    console.log('   3. MR will receive notifications for approval');

  } catch (error) {
    console.error('❌ Error reverting document to draft:', error);
    if (error.code === 'P2025') {
      console.error('   Document not found in database');
    } else if (error.code === 'P2002') {
      console.error('   Unique constraint violation');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
revertAuditReportToDraft(); 