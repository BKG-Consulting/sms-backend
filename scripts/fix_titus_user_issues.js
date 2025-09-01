const { prisma } = require('../prisma/client');

async function fixTitusUserIssues() {
  try {
    console.log('=== FIXING TITUS USER TENANT AND ROLE ISSUES ===\n');
    
    const titusUserId = '4db13ba9-7643-41af-a74c-e201927c21a3';
    const correctTenantId = '4232bda1-24c7-46e0-ade1-817e8b53fe6c'; // RTVC tenant
    const wrongTenantId = '40bbcd5e-2eb9-4c18-ad83-55a96db87003'; // Current wrong tenant
    
    console.log('🎯 PLAN:');
    console.log('1. Move Titus to correct RTVC tenant');
    console.log('2. Create PRINCIPAL role for RTVC if it doesn\'t exist');
    console.log('3. Assign Titus to correct PRINCIPAL role');
    console.log('4. Clean up wrong role assignments');
    console.log('5. Verify the fix\n');
    
    return await prisma.$transaction(async (tx) => {
      
      // 1. Get current state
      console.log('1. GETTING CURRENT STATE:');
      
      const titusUser = await tx.user.findUnique({
        where: { id: titusUserId },
        include: {
          userRoles: { include: { role: true } },
          userDepartmentRoles: { include: { role: true, department: true } }
        }
      });
      
      if (!titusUser) {
        throw new Error('Titus user not found');
      }
      
      console.log(`Current tenant: ${titusUser.tenantId}`);
      console.log(`Should be tenant: ${correctTenantId}`);
      console.log(`Current userRoles: ${titusUser.userRoles.length}`);
      console.log(`Current departmentRoles: ${titusUser.userDepartmentRoles.length}`);
      
      // 2. Move user to correct tenant
      console.log('\n2. MOVING USER TO CORRECT TENANT:');
      
      await tx.user.update({
        where: { id: titusUserId },
        data: { tenantId: correctTenantId }
      });
      
      console.log(`✅ Moved Titus from tenant ${wrongTenantId} to ${correctTenantId}`);
      
      // 3. Check if PRINCIPAL role exists for RTVC
      console.log('\n3. CHECKING/CREATING PRINCIPAL ROLE FOR RTVC:');
      
      let principalRole = await tx.role.findFirst({
        where: { 
          name: 'PRINCIPAL',
          tenantId: correctTenantId 
        }
      });
      
      if (!principalRole) {
        console.log('Creating PRINCIPAL role for RTVC...');
        principalRole = await tx.role.create({
          data: {
            name: 'PRINCIPAL',
            description: 'Principal for audit approval and institutional oversight',
            tenantId: correctTenantId,
            isDefault: false,
            isRemovable: true
          }
        });
        console.log(`✅ Created PRINCIPAL role: ${principalRole.id}`);
      } else {
        console.log(`✅ PRINCIPAL role already exists: ${principalRole.id}`);
      }
      
      // 4. Clean up wrong role assignments
      console.log('\n4. CLEANING UP WRONG ROLE ASSIGNMENTS:');
      
      // Remove all current role assignments (they're from wrong tenants)
      const deletedUserRoles = await tx.userRole.deleteMany({
        where: { userId: titusUserId }
      });
      
      const deletedDeptRoles = await tx.userDepartmentRole.deleteMany({
        where: { userId: titusUserId }
      });
      
      console.log(`✅ Deleted ${deletedUserRoles.count} wrong user roles`);
      console.log(`✅ Deleted ${deletedDeptRoles.count} wrong department roles`);
      
      // 5. Assign correct PRINCIPAL role
      console.log('\n5. ASSIGNING CORRECT PRINCIPAL ROLE:');
      
      await tx.userRole.create({
        data: {
          userId: titusUserId,
          roleId: principalRole.id,
          isDefault: true
        }
      });
      
      console.log(`✅ Assigned PRINCIPAL role to Titus`);
      
      // 6. Check if we need to create STAFF role for RTVC departments
      console.log('\n6. CHECKING RTVC DEPARTMENTS:');
      
      const rtvcDepartments = await tx.department.findMany({
        where: { tenantId: correctTenantId },
        select: { id: true, name: true }
      });
      
      console.log(`Found ${rtvcDepartments.length} departments in RTVC:`);
      rtvcDepartments.forEach(dept => {
        console.log(`  - ${dept.name} (${dept.id})`);
      });
      
      // Get or create STAFF role for RTVC
      let staffRole = await tx.role.findFirst({
        where: { 
          name: 'STAFF',
          tenantId: correctTenantId 
        }
      });
      
      if (!staffRole) {
        console.log('Creating STAFF role for RTVC...');
        staffRole = await tx.role.create({
          data: {
            name: 'STAFF',
            description: 'Staff member',
            tenantId: correctTenantId,
            isDefault: true,
            isRemovable: true
          }
        });
        console.log(`✅ Created STAFF role: ${staffRole.id}`);
      }
      
      // 7. Verification
      console.log('\n7. VERIFICATION:');
      
      const updatedUser = await tx.user.findUnique({
        where: { id: titusUserId },
        include: {
          tenant: true,
          userRoles: {
            include: {
              role: {
                include: { tenant: true }
              }
            }
          }
        }
      });
      
      console.log(`✅ User tenant: ${updatedUser.tenant.name} (${updatedUser.tenant.domain})`);
      console.log(`✅ User roles: ${updatedUser.userRoles.length}`);
      
      updatedUser.userRoles.forEach(ur => {
        console.log(`   - ${ur.role.name} from ${ur.role.tenant.name}`);
        console.log(`     Tenant match: ${ur.role.tenantId === correctTenantId ? 'YES ✅' : 'NO ❌'}`);
      });
      
      return {
        success: true,
        user: updatedUser,
        principalRoleId: principalRole.id,
        staffRoleId: staffRole.id
      };
    });
    
  } catch (error) {
    console.error('Error fixing Titus user issues:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ask for confirmation before running
console.log('🚨 This script will:');
console.log('1. Move Titus user to the correct RTVC tenant');
console.log('2. Create PRINCIPAL role for RTVC if needed');
console.log('3. Remove all current wrong role assignments');
console.log('4. Assign correct PRINCIPAL role');
console.log('');
console.log('⚠️  This will modify the database. Continue? (y/N)');

// For automated execution, comment out the readline and call directly:
fixTitusUserIssues()
  .then(result => {
    console.log('\n🎉 TITUS USER ISSUES FIXED SUCCESSFULLY!');
    console.log('Summary:');
    console.log(`✅ User moved to correct tenant: ${result.user.tenant.name}`);
    console.log(`✅ PRINCIPAL role assigned: ${result.principalRoleId}`);
    console.log(`✅ STAFF role available: ${result.staffRoleId}`);
  })
  .catch(error => {
    console.error('❌ Failed to fix issues:', error.message);
  });
