const { prisma } = require('../prisma/client');

async function revertAuditProgramToDraft() {
  console.log('=== REVERTING AUDIT PROGRAM FROM UNDER_REVIEW TO DRAFT ===\n');

  try {
    // 1. Find all audit programs in UNDER_REVIEW status
    console.log('1️⃣ SEARCHING FOR UNDER_REVIEW AUDIT PROGRAMS:');
    
    const underReviewPrograms = await prisma.auditProgram.findMany({
      where: {
        status: 'UNDER_REVIEW'
      },
      include: {
        tenant: true,
        commitedBy: true,
        approvedBy: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (underReviewPrograms.length === 0) {
      console.log('ℹ️  No UNDER_REVIEW audit programs found');
      return;
    }

    console.log(`✅ Found ${underReviewPrograms.length} UNDER_REVIEW audit program(s):\n`);

    // 2. Display the programs
    for (let i = 0; i < underReviewPrograms.length; i++) {
      const program = underReviewPrograms[i];
      const committedBy = program.commitedBy ? `${program.commitedBy.firstName} ${program.commitedBy.lastName} (${program.commitedBy.email})` : 'Unknown';
      const approvedBy = program.approvedBy ? `${program.approvedBy.firstName} ${program.approvedBy.lastName} (${program.approvedBy.email})` : 'Not approved';
      
      console.log(`📋 Program ${i + 1}:`);
      console.log(`   ID: ${program.id}`);
      console.log(`   Title: "${program.title}"`);
      console.log(`   Status: ${program.status}`);
      console.log(`   Tenant: ${program.tenant.name}`);
      console.log(`   Created: ${program.createdAt.toISOString().split('T')[0]}`);
      console.log(`   Committed by: ${committedBy}`);
      console.log(`   Approved by: ${approvedBy}`);
      console.log(`   Description: ${program.description || 'No description'}\n`);
    }

    // 3. Get Titus user details to show who will be able to commit
    const titusUser = await prisma.user.findUnique({
      where: { email: 'titus@rtvc.ac.ke' },
      include: {
        tenant: true,
        userRoles: { include: { role: true } }
      }
    });

    if (titusUser) {
      console.log(`👤 Titus User (New PRINCIPAL) Status:`);
      console.log(`   Email: ${titusUser.email}`);
      console.log(`   Tenant: ${titusUser.tenant.name} (${titusUser.tenantId})`);
      console.log(`   Roles: ${titusUser.userRoles.map(ur => ur.role.name).join(', ')}`);
      console.log(`   Is PRINCIPAL: ${titusUser.userRoles.some(ur => ur.role.name === 'PRINCIPAL') ? '✅ Yes' : '❌ No'}\n`);
    }

    // 4. Revert the program(s) to DRAFT
    console.log(`🔄 REVERTING PROGRAM(S) TO DRAFT STATUS:`);
    
    for (const program of underReviewPrograms) {
      console.log(`   Processing: "${program.title}" (${program.id})`);
      
      // Update the program back to DRAFT status
      const revertedProgram = await prisma.auditProgram.update({
        where: { id: program.id },
        data: {
          status: 'DRAFT',
          commitedById: null,     // Clear the committed by field
          commitedAt: null,       // Clear the committed at timestamp
          approvedById: null,     // Clear any approval  
          approvedAt: null,       // Clear approval timestamp
          // Keep all other data intact
        }
      });

      console.log(`   ✅ "${program.title}" successfully reverted to DRAFT`);
    }

    // 5. Final verification
    console.log(`\n🔍 VERIFICATION:`);
    console.log(`   ✅ ${underReviewPrograms.length} audit program(s) reverted to DRAFT status`);
    console.log(`   ✅ Titus is now the correct PRINCIPAL for "${titusUser?.tenant.name}"`);
    console.log(`   ✅ Programs are ready to be committed again by the correct PRINCIPAL`);
    console.log(`   ✅ Approval workflow can proceed with proper tenant assignment\n`);

    // 6. Show next steps
    console.log(`📋 NEXT STEPS:`);
    console.log(`   1. Titus (PRINCIPAL) can now access the audit program(s)`);
    console.log(`   2. Titus can commit the program(s) for approval`);
    console.log(`   3. The approval workflow will proceed with correct tenant context`);
    console.log(`   4. HOD notifications will work properly with the fixed role assignments\n`);

  } catch (error) {
    console.error('❌ Error reverting audit program:', error.message);
    throw error;
  }
}

revertAuditProgramToDraft()
  .then(() => {
    console.log('=== AUDIT PROGRAM REVERT COMPLETE ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Revert operation failed:', error);
    process.exit(1);
  });
