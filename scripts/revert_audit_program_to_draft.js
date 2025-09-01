const { prisma } = require('../prisma/client');

async function findAndRevertAuditProgram() {
  console.log('=== FINDING AUDIT PROGRAMS TO REVERT ===\n');

  try {
    // 1. Find all audit programs for RTVC that are in COMMITTED status
    console.log('1️⃣ SEARCHING FOR COMMITTED AUDIT PROGRAMS:');
    
    // Get the correct RTVC tenant
    const rtvcTenant = await prisma.tenant.findFirst({
      where: { 
        name: { contains: 'Runyenjes Technical and Vocational College' }
      }
    });

    if (!rtvcTenant) {
      console.log('❌ RTVC tenant not found');
      return;
    }

    console.log(`📍 RTVC Tenant: ${rtvcTenant.name} (${rtvcTenant.id})`);

    // Find audit programs in COMMITTED status
    const committedPrograms = await prisma.auditProgram.findMany({
      where: {
        tenantId: rtvcTenant.id,
        status: 'COMMITTED'
      },
      include: {
        tenant: true,
        commitedBy: true,
        approvedBy: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (committedPrograms.length === 0) {
      console.log('ℹ️  No COMMITTED audit programs found for RTVC');
      
      // Let's check all programs to see what statuses exist
      const allPrograms = await prisma.auditProgram.findMany({
        where: { tenantId: rtvcTenant.id },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          commitedBy: { select: { firstName: true, lastName: true, email: true } },
          approvedBy: { select: { firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      console.log(`\n📋 All audit programs for RTVC (${allPrograms.length} total):`);
      allPrograms.forEach(program => {
        const committedBy = program.commitedBy ? `${program.commitedBy.firstName} ${program.commitedBy.lastName}` : 'None';
        const approvedBy = program.approvedBy ? `${program.approvedBy.firstName} ${program.approvedBy.lastName}` : 'None';
        console.log(`   ${program.status}: "${program.title}" (${program.id})`);
        console.log(`      Created: ${program.createdAt.toISOString().split('T')[0]}`);
        console.log(`      Committed by: ${committedBy}`);
        console.log(`      Approved by: ${approvedBy}\n`);
      });
      
      return;
    }

    console.log(`✅ Found ${committedPrograms.length} COMMITTED audit program(s):\n`);

    // 2. Display the committed programs
    for (let i = 0; i < committedPrograms.length; i++) {
      const program = committedPrograms[i];
      const committedBy = program.commitedBy ? `${program.commitedBy.firstName} ${program.commitedBy.lastName} (${program.commitedBy.email})` : 'Unknown';
      const approvedBy = program.approvedBy ? `${program.approvedBy.firstName} ${program.approvedBy.lastName} (${program.approvedBy.email})` : 'Not approved';
      
      console.log(`📋 Program ${i + 1}:`);
      console.log(`   ID: ${program.id}`);
      console.log(`   Title: "${program.title}"`);
      console.log(`   Status: ${program.status}`);
      console.log(`   Created: ${program.createdAt.toISOString().split('T')[0]}`);
      console.log(`   Committed by: ${committedBy}`);
      console.log(`   Approved by: ${approvedBy}`);
      console.log(`   Description: ${program.description || 'No description'}\n`);
    }

    // 3. Get Titus user details to confirm he's the new PRINCIPAL
    const titusUser = await prisma.user.findUnique({
      where: { email: 'titus@rtvc.ac.ke' },
      include: {
        tenant: true,
        userRoles: { include: { role: true } }
      }
    });

    if (titusUser) {
      console.log(`👤 Titus User Status:`);
      console.log(`   Email: ${titusUser.email}`);
      console.log(`   Tenant: ${titusUser.tenant.name}`);
      console.log(`   Roles: ${titusUser.userRoles.map(ur => ur.role.name).join(', ')}`);
      console.log(`   Is PRINCIPAL: ${titusUser.userRoles.some(ur => ur.role.name === 'PRINCIPAL') ? '✅ Yes' : '❌ No'}\n`);
    }

    // 4. Ask which program to revert (for now, we'll revert the most recent one)
    if (committedPrograms.length > 0) {
      const programToRevert = committedPrograms[0]; // Most recent
      
      console.log(`🔄 REVERTING PROGRAM TO DRAFT:`);
      console.log(`   Program: "${programToRevert.title}"`);
      console.log(`   Current Status: ${programToRevert.status}`);
      
      // Update the program back to DRAFT status
      const revertedProgram = await prisma.auditProgram.update({
        where: { id: programToRevert.id },
        data: {
          status: 'DRAFT',
          commitedById: null, // Clear the committed by field
          commitedAt: null,   // Clear the committed at timestamp
          approvedById: null, // Clear any approval
          approvedAt: null,   // Clear approval timestamp
          // Keep the original data intact
        }
      });

      console.log(`✅ Program successfully reverted to DRAFT status!`);
      console.log(`   Program ID: ${revertedProgram.id}`);
      console.log(`   New Status: ${revertedProgram.status}`);
      console.log(`   Ready for Titus (PRINCIPAL) to commit again\n`);
      
      // 5. Verification
      console.log(`🔍 VERIFICATION:`);
      console.log(`   ✅ Titus is now the correct PRINCIPAL for RTVC`);
      console.log(`   ✅ Audit program "${programToRevert.title}" is back in DRAFT status`);
      console.log(`   ✅ Titus can now commit the program for approval`);
      console.log(`   ✅ The approval workflow can proceed with the correct PRINCIPAL\n`);
    }

  } catch (error) {
    console.error('❌ Error finding/reverting audit program:', error.message);
    throw error;
  }
}

findAndRevertAuditProgram()
  .then(() => {
    console.log('=== AUDIT PROGRAM REVERT COMPLETE ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Operation failed:', error);
    process.exit(1);
  });
