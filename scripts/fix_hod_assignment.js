const { prisma } = require('../prisma/client');

async function fixHodAssignment() {
  try {
    console.log('=== FIXING HOD Assignment for Research Development Department ===\n');
    
    // 1. Find Wilson (the user with HOD role in Research Development)
    const wilson = await prisma.user.findFirst({
      where: {
        OR: [
          { firstName: { contains: 'wilson', mode: 'insensitive' } },
          { email: { contains: 'wilson', mode: 'insensitive' } }
        ]
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

    console.log('✅ Found Wilson:', {
      id: wilson.id,
      email: wilson.email,
      firstName: wilson.firstName,
      lastName: wilson.lastName
    });

    // 2. Find Research Development department
    const researchDept = await prisma.department.findFirst({
      where: {
        tenantId: wilson.tenantId,
        name: { contains: 'Research', mode: 'insensitive' }
      }
    });

    if (!researchDept) {
      console.log('❌ Research Development department not found');
      return;
    }

    console.log('✅ Found Research Development department:', {
      id: researchDept.id,
      name: researchDept.name,
      currentHodId: researchDept.hodId
    });

    // 3. Check Wilson's roles in this department
    const wilsonDeptRole = wilson.userDepartmentRoles.find(udr => 
      udr.department.id === researchDept.id && 
      (udr.role.name === 'HOD' || udr.role.name === 'HOD AUDITOR')
    );

    if (!wilsonDeptRole) {
      console.log('❌ Wilson does not have HOD role in Research Development department');
      return;
    }

    console.log('✅ Wilson has HOD role in Research Development:', {
      role: wilsonDeptRole.role.name,
      departmentName: wilsonDeptRole.department.name
    });

    // 4. Update the department's hodId field
    if (researchDept.hodId !== wilson.id) {
      console.log('\n🔧 Fixing department hodId assignment...');
      
      const updatedDept = await prisma.department.update({
        where: { id: researchDept.id },
        data: { hodId: wilson.id }
      });

      console.log('✅ Successfully updated Research Development department:');
      console.log(`   - hodId: ${researchDept.hodId} → ${updatedDept.hodId}`);
      console.log(`   - Wilson is now properly assigned as HOD`);
    } else {
      console.log('✅ Department hodId is already correctly assigned');
    }

    // 5. Verify the fix
    console.log('\n=== Verification ===');
    const verifyDept = await prisma.department.findUnique({
      where: { id: researchDept.id },
      include: {
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (verifyDept.hodId === wilson.id) {
      console.log('✅ VERIFICATION PASSED: Wilson is now the official HOD');
      console.log('   HOD Details:', {
        name: `${verifyDept.hod.firstName} ${verifyDept.hod.lastName}`,
        email: verifyDept.hod.email
      });
      console.log('\n🎉 HOD assignment fixed! Judith should now receive HOD notifications when submitting change requests.');
    } else {
      console.log('❌ VERIFICATION FAILED: Department hodId still not correct');
    }

  } catch (error) {
    console.error('Error fixing HOD assignment:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixHodAssignment();
