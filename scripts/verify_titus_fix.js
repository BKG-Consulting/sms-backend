const { prisma } = require('../prisma/client');

async function verifyTitusFix() {
  try {
    console.log('=== VERIFYING TITUS USER FIX STATUS ===\n');
    
    const titusUserId = '4db13ba9-7643-41af-a74c-e201927c21a3';
    const correctTenantId = '4232bda1-24c7-46e0-ade1-817e8b53fe6c'; // RTVC tenant
    
    // Check Titus user current state
    const titusUser = await prisma.user.findUnique({
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
    
    if (!titusUser) {
      console.log('❌ Titus user not found!');
      return;
    }
    
    console.log('CURRENT STATUS:');
    console.log(`✅ User: ${titusUser.firstName} ${titusUser.lastName}`);
    console.log(`✅ Email: ${titusUser.email}`);
    console.log(`✅ Current Tenant: ${titusUser.tenant.name} (${titusUser.tenant.domain})`);
    console.log(`✅ Tenant ID: ${titusUser.tenantId}`);
    console.log(`✅ Is in correct RTVC tenant?: ${titusUser.tenantId === correctTenantId ? 'YES ✅' : 'NO ❌'}`);
    console.log(`✅ Number of roles: ${titusUser.userRoles.length}`);
    
    if (titusUser.userRoles.length > 0) {
      console.log('\nROLE ASSIGNMENTS:');
      titusUser.userRoles.forEach((ur, index) => {
        console.log(`${index + 1}. Role: ${ur.role.name}`);
        console.log(`   From Tenant: ${ur.role.tenant.name} (${ur.role.tenant.domain})`);
        console.log(`   Role Tenant ID: ${ur.role.tenantId}`);
        console.log(`   Correct tenant?: ${ur.role.tenantId === titusUser.tenantId ? 'YES ✅' : 'NO ❌'}`);
        console.log(`   Is Default: ${ur.isDefault ? 'YES' : 'NO'}`);
      });
    } else {
      console.log('\n⚠️ No roles assigned - this needs to be fixed');
    }
    
    // Check if PRINCIPAL role exists for RTVC
    console.log('\nPRINCIPAL ROLE STATUS FOR RTVC:');
    const principalRole = await prisma.role.findFirst({
      where: { 
        name: 'PRINCIPAL',
        tenantId: correctTenantId 
      }
    });
    
    if (principalRole) {
      console.log(`✅ PRINCIPAL role exists for RTVC: ${principalRole.id}`);
      console.log(`   Description: ${principalRole.description}`);
      
      // Check if Titus has this role
      const titusHasPrincipalRole = titusUser.userRoles.some(ur => ur.role.id === principalRole.id);
      console.log(`   Titus has this role: ${titusHasPrincipalRole ? 'YES ✅' : 'NO ❌'}`);
      
      if (!titusHasPrincipalRole && titusUser.userRoles.length === 0) {
        console.log('\n🔧 NEEDS FIXING: Assign PRINCIPAL role to Titus');
      }
    } else {
      console.log(`❌ PRINCIPAL role does NOT exist for RTVC`);
      console.log('🔧 NEEDS FIXING: Create PRINCIPAL role for RTVC and assign to Titus');
    }
    
    console.log('\nSUMMARY:');
    const isInCorrectTenant = titusUser.tenantId === correctTenantId;
    const hasCorrectRoles = titusUser.userRoles.length > 0 && 
                           titusUser.userRoles.every(ur => ur.role.tenantId === titusUser.tenantId);
    const hasPrincipalRole = titusUser.userRoles.some(ur => ur.role.name === 'PRINCIPAL');
    
    if (isInCorrectTenant && hasCorrectRoles && hasPrincipalRole) {
      console.log('🎉 SUCCESS: Titus is correctly configured!');
    } else {
      console.log('⚠️ ISSUES REMAINING:');
      if (!isInCorrectTenant) console.log('   - User not in correct tenant');
      if (!hasCorrectRoles) console.log('   - User has roles from wrong tenants or no roles');
      if (!hasPrincipalRole) console.log('   - User does not have PRINCIPAL role');
    }

  } catch (error) {
    console.error('Error verifying Titus fix:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyTitusFix();
