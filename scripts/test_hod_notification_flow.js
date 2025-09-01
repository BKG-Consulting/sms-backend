const { prisma } = require('../prisma/client');

async function testHodNotificationFlow() {
  try {
    console.log('=== TESTING HOD NOTIFICATION FLOW ===\n');
    
    // 1. Verify current state after our fixes
    console.log('1. Verifying Current State After Fixes:');
    
    // Find Judith
    const judith = await prisma.user.findFirst({
      where: {
        firstName: { contains: 'judith', mode: 'insensitive' }
      },
      include: {
        userDepartmentRoles: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
                hodId: true
              }
            },
            role: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!judith) {
      console.log('❌ Judith not found');
      return;
    }

    console.log('✅ Judith Mutie (Staff Member):', {
      id: judith.id,
      email: judith.email,
      firstName: judith.firstName,
      lastName: judith.lastName
    });

    // Find Wilson
    const wilson = await prisma.user.findFirst({
      where: {
        firstName: { contains: 'wilson', mode: 'insensitive' }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    if (!wilson) {
      console.log('❌ Wilson not found');
      return;
    }

    console.log('✅ Wilson Mungai (HOD):', {
      id: wilson.id,
      email: wilson.email,
      firstName: wilson.firstName,
      lastName: wilson.lastName
    });

    // 2. Check Judith's department roles
    console.log('\n2. Judith\'s Department Assignments:');
    judith.userDepartmentRoles.forEach((udr, index) => {
      console.log(`\nDepartment ${index + 1}:`);
      console.log(`  Department: ${udr.department?.name || 'NULL'}`);
      console.log(`  Role: ${udr.role?.name || 'NULL'}`);
      console.log(`  Department HOD ID: ${udr.department?.hodId || 'NULL'}`);
      console.log(`  HOD is Wilson?: ${udr.department?.hodId === wilson.id ? 'YES ✅' : 'NO ❌'}`);
    });

    // 3. Verify Research Development department state
    console.log('\n3. Research Development Department State:');
    const researchDept = await prisma.department.findFirst({
      where: {
        tenantId: judith.tenantId,
        name: { contains: 'Research', mode: 'insensitive' }
      },
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

    if (researchDept) {
      console.log('✅ Research Development Department:', {
        id: researchDept.id,
        name: researchDept.name,
        hodId: researchDept.hodId,
        hodName: researchDept.hod ? `${researchDept.hod.firstName} ${researchDept.hod.lastName}` : 'NULL',
        hodEmail: researchDept.hod?.email || 'NULL'
      });

      if (researchDept.hodId === wilson.id) {
        console.log('✅ Wilson is correctly assigned as HOD');
      } else {
        console.log('❌ Wilson is NOT assigned as HOD');
      }
    } else {
      console.log('❌ Research Development department not found');
      return;
    }

    // 4. Simulate the notification logic
    console.log('\n4. Simulating HOD Notification Logic:');
    console.log('When Judith submits a change request...');

    // This mimics the logic in documentService.js submitChangeRequest
    if (Array.isArray(judith.userDepartmentRoles) && judith.userDepartmentRoles.length > 0) {
      console.log(`✅ Judith has ${judith.userDepartmentRoles.length} department role(s)`);
      
      const notifiedHodIds = new Set();
      
      for (const userDeptRole of judith.userDepartmentRoles) {
        const dept = userDeptRole.department;
        console.log(`\nProcessing department: ${dept?.name || 'NULL'}`);
        console.log(`  - Department has HOD ID: ${dept?.hodId || 'NULL'}`);
        console.log(`  - HOD ID is different from Judith: ${dept?.hodId !== judith.id ? 'YES' : 'NO'}`);
        console.log(`  - HOD not already notified: ${!notifiedHodIds.has(dept?.hodId) ? 'YES' : 'NO'}`);
        
        if (dept && dept.hodId && dept.hodId !== judith.id && !notifiedHodIds.has(dept.hodId)) {
          console.log(`  ✅ NOTIFICATION WOULD BE SENT TO HOD: ${dept.hodId}`);
          
          // Check if this HOD ID belongs to Wilson
          if (dept.hodId === wilson.id) {
            console.log(`  🎯 THIS IS WILSON - HE WOULD GET THE NOTIFICATION!`);
          } else {
            console.log(`  ⚠️  This is NOT Wilson (${wilson.id})`);
          }
          
          notifiedHodIds.add(dept.hodId);
        } else {
          console.log(`  ❌ No notification would be sent for this department`);
          if (!dept) console.log(`     Reason: No department object`);
          if (!dept?.hodId) console.log(`     Reason: No HOD assigned to department`);
          if (dept?.hodId === judith.id) console.log(`     Reason: Judith is the HOD (self-notification skip)`);
          if (notifiedHodIds.has(dept?.hodId)) console.log(`     Reason: HOD already notified`);
        }
      }
    } else {
      console.log('❌ Judith has no department roles');
    }

    // 5. Final verification
    console.log('\n5. Final Verification:');
    
    const judithInResearchDept = judith.userDepartmentRoles.find(udr => 
      udr.department?.name?.toLowerCase().includes('research')
    );
    
    if (judithInResearchDept) {
      const isStaff = judithInResearchDept.role?.name === 'STAFF';
      const deptHasHod = !!judithInResearchDept.department?.hodId;
      const hodIsWilson = judithInResearchDept.department?.hodId === wilson.id;
      
      console.log('Judith in Research Development:');
      console.log(`  ✅ Is STAFF role: ${isStaff ? 'YES' : 'NO'}`);
      console.log(`  ✅ Department has HOD: ${deptHasHod ? 'YES' : 'NO'}`);
      console.log(`  ✅ HOD is Wilson: ${hodIsWilson ? 'YES' : 'NO'}`);
      
      if (isStaff && deptHasHod && hodIsWilson) {
        console.log('\n🎉 SUCCESS: HOD notification system should work!');
        console.log('When Judith submits a change request, Wilson will be notified.');
      } else {
        console.log('\n❌ ISSUE: Something is still not configured correctly.');
      }
    } else {
      console.log('❌ Judith is not in Research Development department');
    }

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testHodNotificationFlow();
