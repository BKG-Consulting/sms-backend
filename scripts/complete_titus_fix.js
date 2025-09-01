const { prisma } = require('../prisma/client');

async function completeTitusFix() {
  try {
    console.log('=== COMPLETING TITUS USER FIX ===\n');
    
    const titusUserId = '4db13ba9-7643-41af-a74c-e201927c21a3';
    const correctTenantId = '4232bda1-24c7-46e0-ade1-817e8b53fe6c'; // RTVC tenant
    
    // 1. Check current state
    console.log('1. CHECKING CURRENT STATE:');
    
    const titusUser = await prisma.user.findUnique({
      where: { id: titusUserId },
      include: {
        tenant: true,
        userRoles: { include: { role: { include: { tenant: true } } } },
        userDepartmentRoles: { include: { role: true, department: true } }
      }
    });
    
    console.log(`Current tenant: ${titusUser.tenant.name} (${titusUser.tenantId})`);
    console.log(`User roles: ${titusUser.userRoles.length}`);
    console.log(`Department roles: ${titusUser.userDepartmentRoles.length}`);
    
    titusUser.userRoles.forEach(ur => {
      console.log(`  - Role: ${ur.role.name} from ${ur.role.tenant.name}`);
      console.log(`    Correct tenant?: ${ur.role.tenantId === correctTenantId ? 'YES' : 'NO'}`);
    });
    
    // 2. Clean up wrong role assignments (separate transactions)
    console.log('\n2. CLEANING UP WRONG ROLE ASSIGNMENTS:');
    
    const deletedUserRoles = await prisma.userRole.deleteMany({
      where: { userId: titusUserId }
    });
    
    const deletedDeptRoles = await prisma.userDepartmentRole.deleteMany({
      where: { userId: titusUserId }
    });
    
    console.log(`✅ Deleted ${deletedUserRoles.count} wrong user roles`);
    console.log(`✅ Deleted ${deletedDeptRoles.count} wrong department roles`);
    
    // 3. Get or create PRINCIPAL role for RTVC
    console.log('\n3. GETTING PRINCIPAL ROLE FOR RTVC:');
    
    let principalRole = await prisma.role.findFirst({
      where: { 
        name: 'PRINCIPAL',
        tenantId: correctTenantId 
      }
    });
    
    if (principalRole) {
      console.log(`✅ Found existing PRINCIPAL role: ${principalRole.id}`);
    } else {
      console.log('❌ PRINCIPAL role not found - this is unexpected');
      // The previous script should have created it
      return;
    }
    
    // 4. Assign correct PRINCIPAL role
    console.log('\n4. ASSIGNING CORRECT PRINCIPAL ROLE:');
    
    await prisma.userRole.create({
      data: {
        userId: titusUserId,
        roleId: principalRole.id,
        isDefault: true
      }
    });
    
    console.log(`✅ Assigned PRINCIPAL role to Titus`);
    
    // 5. Final verification
    console.log('\n5. FINAL VERIFICATION:');
    
    const finalUser = await prisma.user.findUnique({
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
    
    console.log('✅ FINAL STATE:');
    console.log(`   User: ${finalUser.firstName} ${finalUser.lastName}`);
    console.log(`   Email: ${finalUser.email}`);
    console.log(`   Tenant: ${finalUser.tenant.name} (${finalUser.tenant.domain})`);
    console.log(`   Tenant ID: ${finalUser.tenantId}`);
    console.log(`   Roles: ${finalUser.userRoles.length}`);
    
    finalUser.userRoles.forEach(ur => {
      console.log(`     - ${ur.role.name} from ${ur.role.tenant.name}`);
      console.log(`       Same tenant?: ${ur.role.tenantId === finalUser.tenantId ? 'YES ✅' : 'NO ❌'}`);
    });
    
    if (finalUser.userRoles.length > 0 && 
        finalUser.userRoles.every(ur => ur.role.tenantId === finalUser.tenantId)) {
      console.log('\n🎉 SUCCESS: Titus is now properly assigned to RTVC with correct PRINCIPAL role!');
    } else {
      console.log('\n❌ Issues still remain - please check manually');
    }

  } catch (error) {
    console.error('Error completing Titus fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

completeTitusFix();
