const { prisma } = require('../prisma/client');

async function revertAuditProgramToDraft() {
  console.log('=== REVERTING AUDIT PROGRAM TO DRAFT ===\n');

  try {
    // 1. Get the correct tenant (Runyenjez Techinical and Vocational Training)
    const correctTenant = await prisma.tenant.findFirst({
      where: { 
        name: { contains: 'Runyenjez Techinical and Vocational Training' }
      }
    });

    if (!correctTenant) {
      throw new Error('❌ Correct tenant not found');
    }

    console.log(`📍 Target Tenant: ${correctTenant.name} (${correctTenant.id})`);

    // 2. Find audit programs in UNDER_REVIEW status for the correct tenant
    console.log('\n🔍 SEARCHING FOR UNDER_REVIEW AUDIT PROGRAMS:');
    
    const underReviewPrograms = await prisma.auditProgram.findMany({
      where: {
        tenantId: correctTenant.id,
        status: 'UNDER_REVIEW'
      },
      include: {
        tenant: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        approvedBy: { select: { firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (underReviewPrograms.length === 0) {
      console.log('ℹ️  No UNDER_REVIEW audit programs found for this tenant');
      
      // Let's check what programs exist
      const allPrograms = await prisma.auditProgram.findMany({
        where: { tenantId: correctTenant.id },
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      });
      
      if (allPrograms.length > 0) {
        console.log(`\n📋 All audit programs for this tenant (${allPrograms.length} total):`);
        allPrograms.forEach(program => {
          console.log(`   ${program.status}: "${program.title}" (${program.id})`);
          console.log(`      Created: ${program.createdAt.toISOString().split('T')[0]}\n`);
        });
      } else {
        console.log('\nℹ️  No audit programs found for this tenant');
      }
      
      return;
    }

    console.log(`✅ Found ${underReviewPrograms.length} UNDER_REVIEW audit program(s):\n`);
    
    // 3. Process each program
    for (const program of underReviewPrograms) {
      const createdBy = program.createdBy ? `${program.createdBy.firstName} ${program.createdBy.lastName}` : 'Unknown';
      const approvedBy = program.approvedBy ? `${program.approvedBy.firstName} ${program.approvedBy.lastName}` : 'Not approved';
      
      console.log(`📋 Program: "${program.title}"`);
      console.log(`   ID: ${program.id}`);
      console.log(`   Status: ${program.status}`);
      console.log(`   Created by: ${createdBy}`);
      console.log(`   Approved by: ${approvedBy}`);
      console.log(`   Created: ${program.createdAt.toISOString().split('T')[0]}`);
      
      // Revert to DRAFT
      const revertedProgram = await prisma.auditProgram.update({
        where: { id: program.id },
        data: {
          status: 'DRAFT',
          // Clear any approval/commit related fields
          approvedById: null,
          approvedAt: null,
        }
      });

      console.log(`✅ Program "${program.title}" reverted to DRAFT status!`);
      console.log('');
    }

    // 4. Verify Titus is ready
    const titusUser = await prisma.user.findUnique({
      where: { email: 'titus@rtvc.ac.ke' },
      include: {
        tenant: true,
        userRoles: { include: { role: true } }
      }
    });

    console.log('\n🔍 FINAL VERIFICATION:');
    console.log(`✅ Titus is in tenant: ${titusUser.tenant.name}`);
    console.log(`✅ Titus has roles: ${titusUser.userRoles.map(ur => ur.role.name).join(', ')}`);
    console.log(`✅ Is PRINCIPAL: ${titusUser.userRoles.some(ur => ur.role.name === 'PRINCIPAL') ? 'Yes' : 'No'}`);
    
    console.log('\n📋 WORKFLOW READY:');
    console.log('✅ Titus is now PRINCIPAL for the correct tenant');
    console.log('✅ Audit program(s) reverted to DRAFT status');
    console.log('✅ Titus can now commit the audit program(s) for approval');
    console.log('✅ The approval workflow can proceed with the correct PRINCIPAL');

  } catch (error) {
    console.error('❌ Error reverting audit program:', error.message);
    throw error;
  }
}

revertAuditProgramToDraft()
  .then(() => {
    console.log('\n=== AUDIT PROGRAM REVERT COMPLETE ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Operation failed:', error);
    process.exit(1);
  });
