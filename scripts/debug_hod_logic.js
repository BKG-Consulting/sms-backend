const { prisma } = require('../prisma/client');

async function debugHodAssignmentLogic() {
  try {
    console.log('=== DEBUGGING HOD Assignment Logic ===\n');
    
    // 1. Get Wilson's details
    const wilson = await prisma.user.findFirst({
      where: {
        firstName: { contains: 'wilson', mode: 'insensitive' }
      },
      include: {
        userDepartmentRoles: {
          include: {
            department: true,
            role: true
          }
        }
      }
    });

    if (!wilson) {
      console.log('❌ Wilson not found');
      return;
    }

    console.log('✅ Wilson details:', {
      id: wilson.id,
      email: wilson.email,
      firstName: wilson.firstName,
      tenantId: wilson.tenantId
    });

    // 2. Get HOD roles for Wilson's tenant
    const hodRoles = await prisma.role.findMany({
      where: {
        tenantId: wilson.tenantId,
        name: { in: ['HOD', 'HOD AUDITOR'] }
      }
    });

    console.log('\n=== HOD Roles for Tenant ===');
    hodRoles.forEach(role => {
      console.log(`  - ${role.name} (ID: ${role.id})`);
    });

    const hodRoleIds = hodRoles.map(r => r.id);

    // 3. Analyze Wilson's department roles
    console.log('\n=== Wilson\'s Department Roles Analysis ===');
    wilson.userDepartmentRoles.forEach((udr, index) => {
      console.log(`\nDepartment Role ${index + 1}:`);
      console.log('  Department:', udr.department?.name || 'NULL');
      console.log('  Department ID:', udr.departmentId || 'NULL');
      console.log('  Role:', udr.role?.name || 'NULL');
      console.log('  Role ID:', udr.roleId || 'NULL');
      console.log('  Is HOD Role?:', hodRoleIds.includes(udr.roleId) ? 'YES' : 'NO');
      console.log('  Has Department ID?:', !!udr.departmentId ? 'YES' : 'NO');
      
      // Check if the logic condition would be met
      const wouldTriggerHodLogic = hodRoleIds.includes(udr.roleId) && udr.departmentId;
      console.log('  Would Trigger HOD Logic?:', wouldTriggerHodLogic ? 'YES' : 'NO');
      
      if (wouldTriggerHodLogic) {
        console.log('  🎯 THIS SHOULD HAVE TRIGGERED HOD ASSIGNMENT!');
      }
    });

    // 4. Test the exact logic conditions
    console.log('\n=== Logic Condition Testing ===');
    
    // Simulate the departmentRoles array that would have been passed
    const simulatedDepartmentRoles = wilson.userDepartmentRoles.map(udr => ({
      departmentId: udr.departmentId,
      roleId: udr.roleId,
      isPrimaryDepartment: udr.isPrimaryDepartment,
      isPrimaryRole: udr.isPrimaryRole
    }));

    console.log('Simulated departmentRoles array:', JSON.stringify(simulatedDepartmentRoles, null, 2));

    // Test each department role
    simulatedDepartmentRoles.forEach((dr, index) => {
      console.log(`\nTesting Department Role ${index + 1}:`);
      console.log('  dr.roleId:', dr.roleId);
      console.log('  dr.departmentId:', dr.departmentId);
      console.log('  hodRoleIds.includes(dr.roleId):', hodRoleIds.includes(dr.roleId));
      console.log('  !!dr.departmentId:', !!dr.departmentId);
      
      const condition = hodRoleIds.includes(dr.roleId) && dr.departmentId;
      console.log('  Final condition (hodRoleIds.includes(dr.roleId) && dr.departmentId):', condition);
      
      if (condition) {
        console.log('  ✅ HOD logic SHOULD have been triggered for this role!');
      } else {
        console.log('  ❌ HOD logic would NOT be triggered');
        if (!hodRoleIds.includes(dr.roleId)) {
          console.log('    Reason: Role is not HOD or HOD AUDITOR');
        }
        if (!dr.departmentId) {
          console.log('    Reason: No department ID provided');
        }
      }
    });

    // 5. Check current department state
    console.log('\n=== Current Department State ===');
    const researchDept = await prisma.department.findFirst({
      where: {
        tenantId: wilson.tenantId,
        name: { contains: 'Research', mode: 'insensitive' }
      }
    });

    if (researchDept) {
      console.log('Research Department:', {
        id: researchDept.id,
        name: researchDept.name,
        hodId: researchDept.hodId,
        expectedHodId: wilson.id,
        isCorrect: researchDept.hodId === wilson.id ? 'YES' : 'NO'
      });
    }

    // 6. Check for potential transaction issues
    console.log('\n=== Potential Issues Analysis ===');
    
    // Check if Wilson has multiple department roles with HOD
    const hodDeptRoles = wilson.userDepartmentRoles.filter(udr => 
      hodRoleIds.includes(udr.roleId) && udr.departmentId
    );
    
    if (hodDeptRoles.length === 0) {
      console.log('❌ ISSUE: Wilson has no valid HOD department roles');
    } else if (hodDeptRoles.length > 1) {
      console.log('⚠️  POTENTIAL ISSUE: Wilson has multiple HOD department roles');
      hodDeptRoles.forEach((hdr, index) => {
        console.log(`  HOD Role ${index + 1}: ${hdr.role.name} in ${hdr.department.name}`);
      });
    } else {
      console.log('✅ Wilson has exactly 1 HOD department role - this should work');
      console.log('  Role:', hodDeptRoles[0].role.name);
      console.log('  Department:', hodDeptRoles[0].department.name);
      console.log('  Department ID:', hodDeptRoles[0].departmentId);
      
      // The logic should have worked - check for transaction rollback or other issues
      console.log('\n🔍 CONCLUSION: The logic SHOULD have worked. Possible causes:');
      console.log('  1. Transaction was rolled back due to an error');
      console.log('  2. The department update failed silently');
      console.log('  3. Wilson was updated/created using a different code path');
      console.log('  4. The HOD assignment happened but was later overwritten');
    }

  } catch (error) {
    console.error('Error during debug analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugHodAssignmentLogic();
