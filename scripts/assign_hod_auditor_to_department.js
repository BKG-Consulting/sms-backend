const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function assignHodAuditorToDepartment() {
  console.log('🔧 ASSIGNING HOD AUDITOR TO DEPARTMENT AS HOD\n');

  try {
    // 1. Find all users with HOD AUDITOR role
    console.log('1. 🔍 Finding all users with HOD AUDITOR role...');
    const hodAuditorUsers = await prisma.userRole.findMany({
      where: {
        role: {
          name: 'HOD AUDITOR'
        }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            tenantId: true
          }
        },
        role: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`✅ Found ${hodAuditorUsers.length} users with HOD AUDITOR role`);

    if (hodAuditorUsers.length === 0) {
      console.log('❌ No users with HOD AUDITOR role found');
      return;
    }

    // 2. For each HOD AUDITOR user, check their department assignments
    console.log('\n2. 🔍 Checking department assignments for HOD AUDITOR users...');
    
    for (const hodAuditorUser of hodAuditorUsers) {
      console.log(`\n👤 Processing: ${hodAuditorUser.user.firstName} ${hodAuditorUser.user.lastName} (${hodAuditorUser.user.email})`);
      
      // Get all department assignments for this user
      const departmentAssignments = await prisma.userDepartmentRole.findMany({
        where: {
          userId: hodAuditorUser.user.id
        },
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
      });

      console.log(`   📍 Department assignments: ${departmentAssignments.length}`);

      if (departmentAssignments.length === 0) {
        console.log('   ⚠️  No department assignments found - user has HOD AUDITOR role but no department');
        continue;
      }

      // 3. For each department, check if user should be HOD
      for (const deptAssignment of departmentAssignments) {
        console.log(`   🏢 Department: ${deptAssignment.department.name}`);
        console.log(`   🔑 Current Role: ${deptAssignment.role.name}`);
        console.log(`   👤 Current HOD: ${deptAssignment.department.hodId || 'None'}`);

        // Check if this department already has a HOD
        if (deptAssignment.department.hodId) {
          if (deptAssignment.department.hodId === hodAuditorUser.user.id) {
            console.log('   ✅ User is already HOD for this department');
          } else {
            console.log('   ⚠️  Department already has a different HOD');
            
            // Check if we should replace the current HOD
            const currentHod = await prisma.user.findUnique({
              where: { id: deptAssignment.department.hodId },
              include: {
                userRoles: {
                  include: {
                    role: true
                  }
                }
              }
            });

            if (currentHod) {
              const currentHodHasHodAuditorRole = currentHod.userRoles.some(ur => ur.role.name === 'HOD AUDITOR');
              console.log(`   🔍 Current HOD has HOD AUDITOR role: ${currentHodHasHodAuditorRole}`);
              
              if (currentHodHasHodAuditorRole) {
                console.log('   ⚠️  Current HOD also has HOD AUDITOR role - keeping current HOD');
              } else {
                console.log('   🔄 Replacing current HOD with HOD AUDITOR user');
                await updateDepartmentHod(deptAssignment.department.id, hodAuditorUser.user.id, currentHod.id);
              }
            }
          }
        } else {
          // Department has no HOD, assign the HOD AUDITOR user as HOD
          console.log('   🔄 Assigning HOD AUDITOR user as HOD for this department');
          await updateDepartmentHod(deptAssignment.department.id, hodAuditorUser.user.id, null);
        }
      }
    }

    console.log('\n✅ HOD AUDITOR to department assignment completed!');

  } catch (error) {
    console.error('❌ Error assigning HOD AUDITOR to department:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function updateDepartmentHod(departmentId, newHodId, previousHodId) {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update department HOD
      await tx.department.update({
        where: { id: departmentId },
        data: { hodId: newHodId }
      });

      console.log(`   ✅ Updated department HOD to: ${newHodId}`);

      // 2. If there was a previous HOD, demote them to STAFF role
      if (previousHodId) {
        // Find STAFF role for the tenant
        const department = await tx.department.findUnique({
          where: { id: departmentId },
          include: {
            tenant: true
          }
        });

        const staffRole = await tx.role.findFirst({
          where: {
            name: 'STAFF',
            tenantId: department.tenantId
          }
        });

        if (staffRole) {
          // Remove HOD role from previous HOD
          const hodRole = await tx.role.findFirst({
            where: {
              name: 'HOD',
              tenantId: department.tenantId
            }
          });

          if (hodRole) {
            await tx.userDepartmentRole.deleteMany({
              where: {
                userId: previousHodId,
                departmentId: departmentId,
                roleId: hodRole.id
              }
            });
          }

          // Add STAFF role to previous HOD
          await tx.userDepartmentRole.create({
            data: {
              userId: previousHodId,
              departmentId: departmentId,
              roleId: staffRole.id,
              isPrimaryDepartment: false,
              isPrimaryRole: false
            }
          });

          console.log(`   ✅ Demoted previous HOD (${previousHodId}) to STAFF role`);
        }
      }

      // 3. Add HOD role to new HOD AUDITOR user for this department
      const hodRole = await tx.role.findFirst({
        where: {
          name: 'HOD',
          tenantId: (await tx.department.findUnique({ where: { id: departmentId } })).tenantId
        }
      });

      if (hodRole) {
        // Check if user already has HOD role for this department
        const existingHodRole = await tx.userDepartmentRole.findFirst({
          where: {
            userId: newHodId,
            departmentId: departmentId,
            roleId: hodRole.id
          }
        });

        if (!existingHodRole) {
          await tx.userDepartmentRole.create({
            data: {
              userId: newHodId,
              departmentId: departmentId,
              roleId: hodRole.id,
              isPrimaryDepartment: true,
              isPrimaryRole: true
            }
          });

          console.log(`   ✅ Added HOD role to user ${newHodId} for department ${departmentId}`);
        } else {
          console.log(`   ℹ️  User ${newHodId} already has HOD role for department ${departmentId}`);
        }
      }
    });

  } catch (error) {
    console.error(`   ❌ Error updating department HOD:`, error);
    throw error;
  }
}

// Run the assignment
assignHodAuditorToDepartment(); 