const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixDocumentOwnership() {
  try {
    console.log('🔍 Starting document ownership fix...');

    // Document details from the provided data
    const documentId = 'c2967a20-485f-490b-951e-8c5d9796770c';
    const currentOwnerEmail = 'juma@rtvc.ac.ke';
    const correctOwnerEmail = 'wangari@rtvc.ac.ke';

    // Step 1: Find the correct user (wangari@rtvc.ac.ke)
    console.log('📧 Looking for user:', correctOwnerEmail);
    const correctUser = await prisma.user.findUnique({
      where: { email: correctOwnerEmail },
      select: { id: true, firstName: true, lastName: true, email: true }
    });

    if (!correctUser) {
      console.error('❌ User not found:', correctOwnerEmail);
      return;
    }

    console.log('✅ Found correct user:', {
      id: correctUser.id,
      name: `${correctUser.firstName} ${correctUser.lastName}`,
      email: correctUser.email
    });

    // Step 2: Find the current document
    console.log('📄 Looking for document:', documentId);
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        currentVersion: {
          select: { id: true, createdById: true, version: true }
        }
      }
    });

    if (!document) {
      console.error('❌ Document not found:', documentId);
      return;
    }

    console.log('✅ Found document:', {
      id: document.id,
      title: document.title,
      type: document.type,
      currentOwner: `${document.owner.firstName} ${document.owner.lastName} (${document.owner.email})`
    });

    // Step 3: Verify the current owner is indeed juma@rtvc.ac.ke
    if (document.owner.email !== currentOwnerEmail) {
      console.log('⚠️  Current owner is not juma@rtvc.ac.ke, but:', document.owner.email);
      console.log('Proceeding with ownership change anyway...');
    }

    // Step 4: Update document ownership
    console.log('🔄 Updating document ownership...');
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: { ownerId: correctUser.id },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    console.log('✅ Document ownership updated successfully!');
    console.log('New owner:', `${updatedDocument.owner.firstName} ${updatedDocument.owner.lastName} (${updatedDocument.owner.email})`);

    // Step 5: Update document version createdById if it was created by the old owner
    if (document.currentVersion && document.currentVersion.createdById === document.owner.id) {
      console.log('🔄 Updating document version creator...');
      await prisma.documentVersion.update({
        where: { id: document.currentVersion.id },
        data: { createdById: correctUser.id }
      });
      console.log('✅ Document version creator updated successfully!');
    }

    // Step 6: Verify the changes
    console.log('🔍 Verifying changes...');
    const verificationDocument = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        currentVersion: {
          select: { id: true, createdById: true, version: true }
        }
      }
    });

    console.log('✅ Verification complete!');
    console.log('Final document state:');
    console.log('- Owner:', `${verificationDocument.owner.firstName} ${verificationDocument.owner.lastName} (${verificationDocument.owner.email})`);
    console.log('- Type:', verificationDocument.type);
    console.log('- Status:', verificationDocument.status);
    console.log('- Version:', verificationDocument.currentVersion?.version);

    console.log('🎉 Document ownership fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing document ownership:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  fixDocumentOwnership()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDocumentOwnership }; 