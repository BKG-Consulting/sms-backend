const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixAuditReportOwnership() {
  try {
    console.log('🔍 Starting AUDIT_REPORT ownership fix...');

    // Configuration
    const targetDocumentId = 'c2967a20-485f-490b-951e-8c5d9796770c';
    const correctOwnerEmail = 'wangari@rtvc.ac.ke';
    const incorrectOwnerEmail = 'juma@rtvc.ac.ke';

    // Step 1: Find the correct user (wangari@rtvc.ac.ke)
    console.log('📧 Looking for correct user:', correctOwnerEmail);
    const correctUser = await prisma.user.findUnique({
      where: { email: correctOwnerEmail },
      select: { 
        id: true, 
        firstName: true, 
        lastName: true, 
        email: true,
        tenantId: true
      }
    });

    if (!correctUser) {
      console.error('❌ Correct user not found:', correctOwnerEmail);
      console.log('Available users with similar emails:');
      const similarUsers = await prisma.user.findMany({
        where: {
          email: {
            contains: 'wangari'
          }
        },
        select: { id: true, firstName: true, lastName: true, email: true }
      });
      similarUsers.forEach(user => {
        console.log(`- ${user.firstName} ${user.lastName} (${user.email})`);
      });
      return;
    }

    console.log('✅ Found correct user:', {
      id: correctUser.id,
      name: `${correctUser.firstName} ${correctUser.lastName}`,
      email: correctUser.email,
      tenantId: correctUser.tenantId
    });

    // Step 2: Find the incorrect user (juma@rtvc.ac.ke) for verification
    console.log('📧 Looking for incorrect user:', incorrectOwnerEmail);
    const incorrectUser = await prisma.user.findUnique({
      where: { email: incorrectOwnerEmail },
      select: { id: true, firstName: true, lastName: true, email: true }
    });

    if (!incorrectUser) {
      console.error('❌ Incorrect user not found:', incorrectOwnerEmail);
      return;
    }

    console.log('✅ Found incorrect user:', {
      id: incorrectUser.id,
      name: `${incorrectUser.firstName} ${incorrectUser.lastName}`,
      email: incorrectUser.email
    });

    // Step 3: Find the specific document
    console.log('📄 Looking for document:', targetDocumentId);
    const document = await prisma.document.findUnique({
      where: { id: targetDocumentId },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        currentVersion: {
          select: { 
            id: true, 
            createdById: true, 
            version: true,
            createdAt: true
          }
        },
        audit: {
          select: { id: true, auditNo: true, type: true, status: true }
        }
      }
    });

    if (!document) {
      console.error('❌ Document not found:', targetDocumentId);
      return;
    }

    console.log('✅ Found document:', {
      id: document.id,
      title: document.title,
      type: document.type,
      status: document.status,
      currentOwner: `${document.owner.firstName} ${document.owner.lastName} (${document.owner.email})`,
      audit: document.audit ? `Audit #${document.audit.auditNo} (${document.audit.type})` : 'No audit'
    });

    // Step 4: Verify the current owner is indeed juma@rtvc.ac.ke
    if (document.owner.email !== incorrectOwnerEmail) {
      console.log('⚠️  Current owner is not juma@rtvc.ac.ke, but:', document.owner.email);
      console.log('Proceeding with ownership change anyway...');
    }

    // Step 5: Check if there are any pending approvals or change requests
    console.log('🔍 Checking for pending approvals and change requests...');
    const pendingApprovals = await prisma.documentApproval.findMany({
      where: { documentId: targetDocumentId },
      include: {
        approvedBy: {
          select: { firstName: true, lastName: true, email: true }
        }
      }
    });

    const pendingChangeRequests = await prisma.documentChangeRequest.findMany({
      where: { documentId: targetDocumentId },
      include: {
        requestedBy: {
          select: { firstName: true, lastName: true, email: true }
        }
      }
    });

    console.log(`Found ${pendingApprovals.length} pending approvals and ${pendingChangeRequests.length} change requests`);

    // Step 6: Update document ownership
    console.log('🔄 Updating document ownership...');
    const updatedDocument = await prisma.document.update({
      where: { id: targetDocumentId },
      data: { ownerId: correctUser.id },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    console.log('✅ Document ownership updated successfully!');
    console.log('New owner:', `${updatedDocument.owner.firstName} ${updatedDocument.owner.lastName} (${updatedDocument.owner.email})`);

    // Step 7: Update document version createdById if it was created by the old owner
    if (document.currentVersion && document.currentVersion.createdById === incorrectUser.id) {
      console.log('🔄 Updating document version creator...');
      await prisma.documentVersion.update({
        where: { id: document.currentVersion.id },
        data: { createdById: correctUser.id }
      });
      console.log('✅ Document version creator updated successfully!');
    } else {
      console.log('ℹ️  Document version creator was not the old owner, no update needed');
    }

    // Step 8: Check for other AUDIT_REPORT documents that might have the same issue
    console.log('🔍 Checking for other AUDIT_REPORT documents with incorrect ownership...');
    const otherIncorrectDocuments = await prisma.document.findMany({
      where: {
        type: 'AUDIT_REPORT',
        ownerId: incorrectUser.id,
        id: { not: targetDocumentId }
      },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        audit: {
          select: { id: true, auditNo: true, type: true, status: true }
        }
      }
    });

    if (otherIncorrectDocuments.length > 0) {
      console.log(`⚠️  Found ${otherIncorrectDocuments.length} other AUDIT_REPORT documents with incorrect ownership:`);
      otherIncorrectDocuments.forEach(doc => {
        console.log(`- ${doc.title} (${doc.id}) - Owner: ${doc.owner.firstName} ${doc.owner.lastName}`);
      });
      console.log('Consider running this script for these documents as well.');
    } else {
      console.log('✅ No other AUDIT_REPORT documents with incorrect ownership found');
    }

    // Step 9: Verify the changes
    console.log('🔍 Verifying changes...');
    const verificationDocument = await prisma.document.findUnique({
      where: { id: targetDocumentId },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        currentVersion: {
          select: { id: true, createdById: true, version: true }
        },
        audit: {
          select: { id: true, auditNo: true, type: true, status: true }
        }
      }
    });

    console.log('✅ Verification complete!');
    console.log('Final document state:');
    console.log('- Owner:', `${verificationDocument.owner.firstName} ${verificationDocument.owner.lastName} (${verificationDocument.owner.email})`);
    console.log('- Type:', verificationDocument.type);
    console.log('- Status:', verificationDocument.status);
    console.log('- Version:', verificationDocument.currentVersion?.version);
    console.log('- Audit:', verificationDocument.audit ? `Audit #${verificationDocument.audit.auditNo} (${verificationDocument.audit.type})` : 'No audit');

    // Step 10: Check if the user can now see the document for approval
    console.log('🔍 Checking user permissions...');
    const userRoles = await prisma.userRole.findMany({
      where: { userId: correctUser.id },
      include: {
        role: {
          select: { name: true, description: true }
        }
      }
    });

    console.log('User roles:', userRoles.map(ur => ur.role.name).join(', '));

    console.log('🎉 AUDIT_REPORT ownership fix completed successfully!');
    console.log('📝 Summary:');
    console.log(`- Document: ${verificationDocument.title}`);
    console.log(`- Old owner: ${incorrectUser.firstName} ${incorrectUser.lastName} (${incorrectUser.email})`);
    console.log(`- New owner: ${verificationDocument.owner.firstName} ${verificationDocument.owner.lastName} (${verificationDocument.owner.email})`);
    console.log(`- Status: ${verificationDocument.status}`);
    console.log(`- Type: ${verificationDocument.type}`);

  } catch (error) {
    console.error('❌ Error fixing AUDIT_REPORT ownership:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  fixAuditReportOwnership()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAuditReportOwnership }; 