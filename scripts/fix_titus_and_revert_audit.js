const { prisma } = require('../prisma/client');

async function fixTitusToCorrectTenantAndRevertAudit() {
  console.log('=== FIXING TITUS TO CORRECT TENANT AND REVERTING AUDIT ===\n');

  try {
    await prisma.$transaction(async (tx) => {
      console.log('🔄 Starting transaction...\n');

      // 1. Get the Titus user and verify current state
      const titusUser = await tx.user.findUnique({
        where: { email: 'titus@rtvc.ac.ke' },
        include: {
          tenant: true,
          userRoles: { include: { role: true } },
          userDepartmentRoles: { include: { role: true, department: true } }
        }
      });

      if (!titusUser) {
        throw new Error('❌ Titus user not found');
      }

      console.log('👤 Current Titus User State:');
      console.log(`   Email: ${titusUser.email}`);
      console.log(`   Current Tenant: ${titusUser.tenant.name}`);
      console.log(`   Current Tenant ID: ${titusUser.tenantId}`);
      console.log(`   User Roles: ${titusUser.userRoles.length}`);
      titusUser.userRoles.forEach(ur => {
        console.log(`      - ${ur.role.name} (from tenant: ${ur.role.tenantId})`);
      });

      // 2. Get the CORRECT tenant (Runyenjez Techinical and Vocational Training)
      const correctTenant = await tx.tenant.findFirst({
        where: { 
          name: { contains: 'Runyenjez Techinical and Vocational Training' }
        }
      });

      if (!correctTenant) {
        throw new Error('❌ Correct tenant (Runyenjez Techinical and Vocational Training) not found');
      }

      console.log(`\n🎯 Target Tenant: ${correctTenant.name} (${correctTenant.id})`);

      // 3. Create or get PRINCIPAL role for the correct tenant
      let principalRole = await tx.role.findFirst({
        where: { 
          name: 'PRINCIPAL',
          tenantId: correctTenant.id
        }
      });

      if (!principalRole) {
        principalRole = await tx.role.create({
          data: {
            name: 'PRINCIPAL',
            description: 'Principal of the institution',
            tenantId: correctTenant.id,
            loginDestination: '/mr-dashboard',
            defaultContext: 'institution',
            isDefault: false,
            isRemovable: true
          }
        });
        console.log(`✅ Created PRINCIPAL role for correct tenant: ${principalRole.id}`);
      } else {
        console.log(`✅ PRINCIPAL role already exists for correct tenant: ${principalRole.id}`);
      }

      // 4. Clean up ALL existing role assignments for Titus
      console.log('\n🧹 Cleaning up existing role assignments...');
      
      const deletedUserRoles = await tx.userRole.deleteMany({
        where: { userId: titusUser.id }
      });
      console.log(`   Deleted ${deletedUserRoles.count} user roles`);

      const deletedDeptRoles = await tx.userDepartmentRole.deleteMany({
        where: { userId: titusUser.id }
      });
      console.log(`   Deleted ${deletedDeptRoles.count} department roles`);

      // 5. Update user's tenant if needed
      if (titusUser.tenantId !== correctTenant.id) {
        await tx.user.update({
          where: { id: titusUser.id },
          data: { tenantId: correctTenant.id }
        });
        console.log(`✅ Updated Titus tenant from ${titusUser.tenantId} to ${correctTenant.id}`);
      } else {
        console.log(`✅ Titus already in correct tenant: ${correctTenant.name}`);
      }

      // 6. Assign PRINCIPAL role
      await tx.userRole.create({
        data: {
          userId: titusUser.id,
          roleId: principalRole.id,
          isDefault: true
        }
      });
      console.log(`✅ Assigned PRINCIPAL role to Titus`);

      console.log('\n🎉 User fix transaction completed successfully!');
    }, {
      timeout: 30000 // 30 seconds timeout
    });

    // 7. Now handle the audit program revert
    console.log('\n📋 REVERTING AUDIT PROGRAM FROM UNDER_REVIEW TO DRAFT:');
    
    const correctTenant = await prisma.tenant.findFirst({
      where: { 
        name: { contains: 'Runyenjez Techinical and Vocational Training' }
      }
    });

    // Find audit programs in UNDER_REVIEW status for the correct tenant
    const underReviewPrograms = await prisma.auditProgram.findMany({
      where: {
        tenantId: correctTenant.id,
        status: 'UNDER_REVIEW'
      },
      include: {
        tenant: true,
        commitedBy: { select: { firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (underReviewPrograms.length === 0) {
      console.log('ℹ️  No UNDER_REVIEW audit programs found for the correct tenant');
    } else {
      console.log(`✅ Found ${underReviewPrograms.length} UNDER_REVIEW audit program(s):\n`);
      
      for (const program of underReviewPrograms) {
        const committedBy = program.commitedBy ? `${program.commitedBy.firstName} ${program.commitedBy.lastName}` : 'Unknown';
        
        console.log(`📋 Program: "${program.title}"`);
        console.log(`   ID: ${program.id}`);
        console.log(`   Status: ${program.status}`);
        console.log(`   Committed by: ${committedBy}`);
        console.log(`   Created: ${program.createdAt.toISOString().split('T')[0]}`);
        
        // Revert to DRAFT
        const revertedProgram = await prisma.auditProgram.update({
          where: { id: program.id },
          data: {
            status: 'DRAFT',
            commitedById: null, // Clear the committed by field
            commitedAt: null,   // Clear the committed at timestamp
            approvedById: null, // Clear any approval
            approvedAt: null,   // Clear approval timestamp
          }
        });

        console.log(`✅ Program "${program.title}" reverted to DRAFT status!`);
        console.log('');
      }
    }

    // 8. Final verification
    console.log('\n🔍 FINAL VERIFICATION:');
    const verifyUser = await prisma.user.findUnique({
      where: { email: 'titus@rtvc.ac.ke' },
      include: {
        tenant: true,
        userRoles: { include: { role: true } }
      }
    });

    console.log(`✅ Titus is now in tenant: ${verifyUser.tenant.name}`);
    console.log(`✅ Roles assigned: ${verifyUser.userRoles.length}`);
    verifyUser.userRoles.forEach(ur => {
      console.log(`   - ${ur.role.name} (Default: ${ur.isDefault}) from tenant: ${ur.role.tenantId}`);
    });

    console.log('\n📋 READY FOR WORKFLOW:');
    console.log('✅ Titus is now PRINCIPAL for the correct tenant');
    console.log('✅ Audit program(s) reverted to DRAFT status');
    console.log('✅ Titus can now commit the audit program(s) for approval');

  } catch (error) {
    console.error('❌ Error fixing Titus and reverting audit:', error.message);
    throw error;
  }
}

fixTitusToCorrectTenantAndRevertAudit()
  .then(() => {
    console.log('\n=== TITUS FIX AND AUDIT REVERT COMPLETE ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Operation failed:', error);
    process.exit(1);
  });
