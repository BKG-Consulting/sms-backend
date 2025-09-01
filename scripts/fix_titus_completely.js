const { prisma } = require('../prisma/client');

async function fixTitusUserCompletely() {
  console.log('=== FIXING TITUS USER COMPLETELY ===\n');

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
        console.log(`      - ${ur.role.name} (${ur.role.tenantId})`);
      });
      console.log(`   Department Roles: ${titusUser.userDepartmentRoles.length}`);

      // 2. Get the correct tenant (RTVC)
      const correctTenant = await tx.tenant.findFirst({
        where: { 
          name: { contains: 'Runyenjes Technical and Vocational College' }
        }
      });

      if (!correctTenant) {
        throw new Error('❌ Correct tenant (RTVC) not found');
      }

      console.log(`\n🎯 Target Tenant: ${correctTenant.name} (${correctTenant.id})`);

      // 3. Create PRINCIPAL role for the correct tenant if it doesn't exist
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
        console.log(`✅ Created PRINCIPAL role for RTVC: ${principalRole.id}`);
      } else {
        console.log(`✅ PRINCIPAL role already exists for RTVC: ${principalRole.id}`);
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

      // 5. Update user's tenant
      if (titusUser.tenantId !== correctTenant.id) {
        await tx.user.update({
          where: { id: titusUser.id },
          data: { tenantId: correctTenant.id }
        });
        console.log(`✅ Updated Titus tenant from ${titusUser.tenantId} to ${correctTenant.id}`);
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

      console.log('\n🎉 Transaction completed successfully!');
    }, {
      timeout: 30000 // 30 seconds timeout
    });

    // 7. Verify the fix
    console.log('\n🔍 VERIFICATION:');
    const verifyUser = await prisma.user.findUnique({
      where: { email: 'titus@rtvc.ac.ke' },
      include: {
        tenant: true,
        userRoles: { include: { role: true } },
        userDepartmentRoles: { include: { role: true, department: true } }
      }
    });

    console.log(`✅ Titus is now in tenant: ${verifyUser.tenant.name}`);
    console.log(`✅ Roles assigned: ${verifyUser.userRoles.length}`);
    verifyUser.userRoles.forEach(ur => {
      console.log(`   - ${ur.role.name} (Default: ${ur.isDefault})`);
    });

  } catch (error) {
    console.error('❌ Error fixing Titus user:', error.message);
    throw error;
  }
}

fixTitusUserCompletely()
  .then(() => {
    console.log('\n=== TITUS USER FIX COMPLETE ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });
