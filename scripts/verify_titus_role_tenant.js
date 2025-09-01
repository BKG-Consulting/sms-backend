const { prisma } = require('../prisma/client');

async function verifyTitusRoleAndTenant() {
  console.log('=== VERIFYING TITUS ROLE AND TENANT ASSIGNMENT ===\n');

  try {
    // 1. Get Titus user with all details
    const titusUser = await prisma.user.findUnique({
      where: { email: 'titus@rtvc.ac.ke' },
      include: {
        tenant: true,
        userRoles: { 
          include: { 
            role: { 
              include: { tenant: true } 
            } 
          } 
        },
        userDepartmentRoles: { 
          include: { 
            role: { 
              include: { tenant: true } 
            },
            department: { 
              include: { tenant: true } 
            } 
          } 
        }
      }
    });

    if (!titusUser) {
      console.log('❌ Titus user not found');
      return;
    }

    console.log('👤 TITUS USER DETAILS:');
    console.log(`   Name: ${titusUser.firstName} ${titusUser.lastName}`);
    console.log(`   Email: ${titusUser.email}`);
    console.log(`   User ID: ${titusUser.id}`);
    console.log(`   User Tenant: ${titusUser.tenant.name}`);
    console.log(`   User Tenant ID: ${titusUser.tenantId}\n`);

    // 2. Check User Roles (global/tenant roles)
    console.log('🔐 USER ROLES ANALYSIS:');
    if (titusUser.userRoles.length === 0) {
      console.log('   ℹ️  No user roles assigned');
    } else {
      console.log(`   Found ${titusUser.userRoles.length} user role(s):\n`);
      
      for (const userRole of titusUser.userRoles) {
        const role = userRole.role;
        const roleTenant = role.tenant;
        const isCorrectTenant = role.tenantId === titusUser.tenantId;
        
        console.log(`   📋 Role: ${role.name}`);
        console.log(`      Role ID: ${role.id}`);
        console.log(`      Role Tenant: ${roleTenant.name}`);
        console.log(`      Role Tenant ID: ${role.tenantId}`);
        console.log(`      Is Default: ${userRole.isDefault ? 'Yes' : 'No'}`);
        console.log(`      ✅ Tenant Match: ${isCorrectTenant ? 'CORRECT' : '❌ MISMATCH'}`);
        
        if (!isCorrectTenant) {
          console.log(`      ⚠️  PROBLEM: Role belongs to "${roleTenant.name}" but user is in "${titusUser.tenant.name}"`);
        }
        console.log('');
      }
    }

    // 3. Check Department Roles
    console.log('🏢 DEPARTMENT ROLES ANALYSIS:');
    if (titusUser.userDepartmentRoles.length === 0) {
      console.log('   ℹ️  No department roles assigned');
    } else {
      console.log(`   Found ${titusUser.userDepartmentRoles.length} department role(s):\n`);
      
      for (const deptRole of titusUser.userDepartmentRoles) {
        const role = deptRole.role;
        const department = deptRole.department;
        const roleTenant = role.tenant;
        const deptTenant = department ? department.tenant : null;
        
        const roleMatch = role.tenantId === titusUser.tenantId;
        const deptMatch = department ? department.tenantId === titusUser.tenantId : true;
        
        console.log(`   📋 Department Role: ${role.name}`);
        console.log(`      Role ID: ${role.id}`);
        console.log(`      Department: ${department ? department.name : 'None'}`);
        console.log(`      Role Tenant: ${roleTenant.name}`);
        console.log(`      Dept Tenant: ${deptTenant ? deptTenant.name : 'N/A'}`);
        console.log(`      Is Primary Dept: ${deptRole.isPrimaryDepartment ? 'Yes' : 'No'}`);
        console.log(`      Is Primary Role: ${deptRole.isPrimaryRole ? 'Yes' : 'No'}`);
        console.log(`      Is Default: ${deptRole.isDefault ? 'Yes' : 'No'}`);
        console.log(`      ✅ Role Tenant Match: ${roleMatch ? 'CORRECT' : '❌ MISMATCH'}`);
        console.log(`      ✅ Dept Tenant Match: ${deptMatch ? 'CORRECT' : '❌ MISMATCH'}`);
        console.log('');
      }
    }

    // 4. Overall Assessment
    console.log('📊 OVERALL ASSESSMENT:');
    
    const allUserRolesValid = titusUser.userRoles.every(ur => ur.role.tenantId === titusUser.tenantId);
    const allDeptRolesValid = titusUser.userDepartmentRoles.every(udr => udr.role.tenantId === titusUser.tenantId);
    const allDeptTenantsValid = titusUser.userDepartmentRoles.every(udr => !udr.department || udr.department.tenantId === titusUser.tenantId);
    
    const hasPrincipalRole = titusUser.userRoles.some(ur => ur.role.name === 'PRINCIPAL') || 
                           titusUser.userDepartmentRoles.some(udr => udr.role.name === 'PRINCIPAL');
    
    console.log(`   User Tenant: "${titusUser.tenant.name}"`);
    console.log(`   Has PRINCIPAL Role: ${hasPrincipalRole ? '✅ YES' : '❌ NO'}`);
    console.log(`   All User Roles Valid: ${allUserRolesValid ? '✅ YES' : '❌ NO'}`);
    console.log(`   All Dept Roles Valid: ${allDeptRolesValid ? '✅ YES' : '❌ NO'}`);
    console.log(`   All Dept Tenants Valid: ${allDeptTenantsValid ? '✅ YES' : '❌ NO'}`);
    
    const isFullyValid = allUserRolesValid && allDeptRolesValid && allDeptTenantsValid && hasPrincipalRole;
    
    console.log(`\n🎯 FINAL STATUS: ${isFullyValid ? '✅ FULLY VALID' : '❌ ISSUES DETECTED'}`);
    
    if (!isFullyValid) {
      console.log('\n🚨 ISSUES DETECTED:');
      if (!hasPrincipalRole) {
        console.log('   - Titus does not have PRINCIPAL role');
      }
      if (!allUserRolesValid) {
        console.log('   - Some user roles belong to wrong tenant');
      }
      if (!allDeptRolesValid) {
        console.log('   - Some department roles belong to wrong tenant');
      }
      if (!allDeptTenantsValid) {
        console.log('   - Some departments belong to wrong tenant');
      }
    } else {
      console.log('\n🎉 ALL VALIDATIONS PASSED:');
      console.log('   ✅ Titus has PRINCIPAL role');
      console.log('   ✅ All roles belong to correct tenant');
      console.log('   ✅ All departments belong to correct tenant');
      console.log('   ✅ No cross-tenant contamination detected');
    }

    // 5. Show specific PRINCIPAL role details
    const principalUserRole = titusUser.userRoles.find(ur => ur.role.name === 'PRINCIPAL');
    const principalDeptRole = titusUser.userDepartmentRoles.find(udr => udr.role.name === 'PRINCIPAL');
    
    if (principalUserRole || principalDeptRole) {
      console.log('\n👑 PRINCIPAL ROLE DETAILS:');
      
      if (principalUserRole) {
        console.log('   Type: User Role (Global/Tenant Role)');
        console.log(`   Role ID: ${principalUserRole.role.id}`);
        console.log(`   Role Tenant: ${principalUserRole.role.tenant.name}`);
        console.log(`   Is Default: ${principalUserRole.isDefault ? 'Yes' : 'No'}`);
        console.log(`   Tenant Match: ${principalUserRole.role.tenantId === titusUser.tenantId ? 'CORRECT' : 'MISMATCH'}`);
      }
      
      if (principalDeptRole) {
        console.log('   Type: Department Role');
        console.log(`   Role ID: ${principalDeptRole.role.id}`);
        console.log(`   Role Tenant: ${principalDeptRole.role.tenant.name}`);
        console.log(`   Department: ${principalDeptRole.department ? principalDeptRole.department.name : 'None'}`);
        console.log(`   Is Default: ${principalDeptRole.isDefault ? 'Yes' : 'No'}`);
        console.log(`   Tenant Match: ${principalDeptRole.role.tenantId === titusUser.tenantId ? 'CORRECT' : 'MISMATCH'}`);
      }
    }

  } catch (error) {
    console.error('❌ Error verifying Titus role and tenant:', error.message);
    throw error;
  }
}

verifyTitusRoleAndTenant()
  .then(() => {
    console.log('\n=== VERIFICATION COMPLETE ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
