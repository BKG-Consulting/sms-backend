const { prisma } = require('../prisma/client');

async function debugJudithHodAssignment() {
  try {
    console.log('=== DEBUG: Judith Mutie HOD Assignment Analysis ===\n');
    
    // 1. Find Judith Mutie
    const judith = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { contains: 'judith', mode: 'insensitive' } },
          { firstName: { contains: 'judith', mode: 'insensitive' } },
          { lastName: { contains: 'mutie', mode: 'insensitive' } }
        ]
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
        },
        userRoles: {
          include: {
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
      console.log('❌ Judith Mutie not found in database');
      return;
    }

    console.log('✅ Found Judith Mutie:', {
      id: judith.id,
      email: judith.email,
      firstName: judith.firstName,
      lastName: judith.lastName,
      tenantId: judith.tenantId
    });

    // 2. Analyze her department roles
    console.log('\n=== Department Roles Analysis ===');
    if (judith.userDepartmentRoles.length === 0) {
      console.log('❌ Judith has NO department roles assigned');
    } else {
      judith.userDepartmentRoles.forEach((udr, index) => {
        console.log(`\nDepartment Role ${index + 1}:`);
        console.log('  Department:', udr.department?.name || 'NULL');
        console.log('  Role:', udr.role?.name || 'NULL');
        console.log('  Department HOD ID:', udr.department?.hodId || 'NULL');
        console.log('  Is Judith the HOD?:', udr.department?.hodId === judith.id ? 'YES' : 'NO');
        console.log('  Primary Department?:', udr.isPrimaryDepartment ? 'YES' : 'NO');
        console.log('  Primary Role?:', udr.isPrimaryRole ? 'YES' : 'NO');
      });
    }

    // 3. Analyze her tenant roles
    console.log('\n=== Tenant/Global Roles Analysis ===');
    if (judith.userRoles.length === 0) {
      console.log('❌ Judith has NO tenant/global roles assigned');
    } else {
      judith.userRoles.forEach((ur, index) => {
        console.log(`Tenant Role ${index + 1}: ${ur.role?.name || 'NULL'}`);
      });
    }

    // 4. Check if there's a Research Development department
    console.log('\n=== Research Development Department Analysis ===');
    const researchDept = await prisma.department.findFirst({
      where: {
        tenantId: judith.tenantId,
        name: { contains: 'Research', mode: 'insensitive' }
      },
      include: {
        userDepartmentRoles: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true }
            },
            role: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!researchDept) {
      console.log('❌ No Research Development department found');
    } else {
      console.log('✅ Found Research Development department:', {
        id: researchDept.id,
        name: researchDept.name,
        hodId: researchDept.hodId,
        tenantId: researchDept.tenantId
      });

      // Check who is assigned to this department
      console.log('\n=== Department Members ===');
      if (researchDept.userDepartmentRoles.length === 0) {
        console.log('❌ No users assigned to Research Development department');
      } else {
        researchDept.userDepartmentRoles.forEach((udr, index) => {
          console.log(`\nMember ${index + 1}:`);
          console.log('  User:', `${udr.user.firstName} ${udr.user.lastName} (${udr.user.email})`);
          console.log('  Role:', udr.role?.name || 'NULL');
          console.log('  Is HOD?:', researchDept.hodId === udr.user.id ? 'YES' : 'NO');
        });
      }

      // Check if there's anyone with HOD role in this department
      const hodInDept = researchDept.userDepartmentRoles.find(udr => 
        udr.role?.name === 'HOD' || udr.role?.name === 'HOD AUDITOR'
      );
      
      if (hodInDept) {
        console.log('\n✅ Found HOD role in department:', {
          user: `${hodInDept.user.firstName} ${hodInDept.user.lastName}`,
          role: hodInDept.role.name,
          isSetAsHod: researchDept.hodId === hodInDept.user.id ? 'YES' : 'NO'
        });
      } else {
        console.log('\n❌ No HOD role found in Research Development department');
      }
    }

    // 5. Check if HOD roles exist for this tenant
    console.log('\n=== HOD Roles Analysis ===');
    const hodRoles = await prisma.role.findMany({
      where: {
        tenantId: judith.tenantId,
        name: { in: ['HOD', 'HOD AUDITOR'] }
      }
    });

    if (hodRoles.length === 0) {
      console.log('❌ No HOD or HOD AUDITOR roles found for this tenant');
    } else {
      console.log('✅ Found HOD roles for tenant:');
      hodRoles.forEach(role => {
        console.log(`  - ${role.name} (ID: ${role.id})`);
      });
    }

  } catch (error) {
    console.error('Error during debug analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugJudithHodAssignment();
