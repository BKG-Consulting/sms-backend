const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function assignPrincipalAsHod() {
  console.log('👨‍💼 ASSIGNING PRINCIPAL AS HOD FOR TOP MANAGEMENT\n');

  try {
    // 1. Find the PRINCIPAL role in Nachu Technical and Vocational College tenant
    console.log('1. 🔍 Finding PRINCIPAL role in Nachu Technical and Vocational College...');
    const nachuTenant = await prisma.tenant.findUnique({
      where: {
        id: 'f64d0712-a02c-4147-bddb-2af191138a49'
      }
    });

    if (!nachuTenant) {
      console.log('❌ Nachu Technical and Vocational College tenant not found');
      console.log('🔍 Available tenants:');
      const allTenants = await prisma.tenant.findMany({
        select: { name: true, domain: true, id: true }
      });
      allTenants.forEach(tenant => {
        console.log(`   • ${tenant.name} (${tenant.domain}) - ID: ${tenant.id}`);
      });
      return;
    }

    console.log(`✅ Found Nachu tenant: ${nachuTenant.name}`);
    console.log(`   Tenant ID: ${nachuTenant.id}`);
    console.log(`   Domain: ${nachuTenant.domain}`);

    const principalRole = await prisma.role.findFirst({
      where: {
        name: 'PRINCIPAL',
        tenantId: nachuTenant.id
      },
      include: {
        tenant: {
          select: {
            name: true,
            domain: true
          }
        }
      }
    });

    if (!principalRole) {
      console.log('❌ PRINCIPAL role not found in Nachu tenant');
      console.log('🔍 Available roles in Nachu tenant:');
      const allRoles = await prisma.role.findMany({
        where: { tenantId: nachuTenant.id },
        select: { name: true }
      });
      allRoles.forEach(role => {
        console.log(`   • ${role.name}`);
      });
      return;
    }

    console.log(`✅ Found PRINCIPAL role: ${principalRole.name}`);
    console.log(`   Tenant: ${principalRole.tenant.name}`);
    console.log(`   Role ID: ${principalRole.id}`);

    // 2. Find users with PRINCIPAL role
    console.log('\n2. 🔍 Finding users with PRINCIPAL role...');
    const principalUsers = await prisma.userRole.findMany({
      where: {
        roleId: principalRole.id
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

    console.log(`✅ Found ${principalUsers.length} users with PRINCIPAL role`);

    if (principalUsers.length === 0) {
      console.log('❌ No users with PRINCIPAL role found');
      return;
    }

    // 3. Find the Top Management department
    console.log('\n3. 🔍 Finding Top Management department...');
    const topManagementDept = await prisma.department.findFirst({
      where: {
        name: {
          contains: 'Top Management',
          mode: 'insensitive'
        },
        tenantId: principalRole.tenantId
      },
      include: {
        tenant: {
          select: {
            name: true
          }
        }
      }
    });

    if (!topManagementDept) {
      console.log('❌ Top Management department not found');
      console.log('🔍 Available departments:');
      const allDepartments = await prisma.department.findMany({
        where: { tenantId: principalRole.tenantId },
        select: { name: true }
      });
      allDepartments.forEach(dept => {
        console.log(`   • ${dept.name}`);
      });
      return;
    }

    console.log(`✅ Found Top Management department: ${topManagementDept.name}`);
    console.log(`   Department ID: ${topManagementDept.id}`);
    console.log(`   Current HOD: ${topManagementDept.hodId || 'None'}`);

    // 4. Find HOD role for the tenant
    console.log('\n4. 🔍 Finding HOD role...');
    const hodRole = await prisma.role.findFirst({
      where: {
        name: 'HOD',
        tenantId: principalRole.tenantId
      }
    });

    if (!hodRole) {
      console.log('❌ HOD role not found for this tenant');
      return;
    }

    console.log(`✅ Found HOD role: ${hodRole.name}`);
    console.log(`   HOD Role ID: ${hodRole.id}`);

    // 5. Process each PRINCIPAL user
    console.log('\n5. 🔧 Processing PRINCIPAL users...');
    
    for (const principalUser of principalUsers) {
      console.log(`\n👤 Processing: ${principalUser.user.firstName} ${principalUser.user.lastName} (${principalUser.user.email})`);
      
      try {
        await prisma.$transaction(async (tx) => {
          // Check if user already has HOD role for Top Management
          const existingHodRole = await tx.userDepartmentRole.findFirst({
            where: {
              userId: principalUser.user.id,
              departmentId: topManagementDept.id,
              roleId: hodRole.id
            }
          });

          if (existingHodRole) {
            console.log('   ℹ️  User already has HOD role for Top Management');
          } else {
            // Add HOD role for Top Management department
            await tx.userDepartmentRole.create({
              data: {
                userId: principalUser.user.id,
                departmentId: topManagementDept.id,
                roleId: hodRole.id,
                isPrimaryDepartment: true,
                isPrimaryRole: true
              }
            });
            console.log('   ✅ Added HOD role for Top Management department');
          }

          // Update department HOD
          await tx.department.update({
            where: { id: topManagementDept.id },
            data: { hodId: principalUser.user.id }
          });
          console.log('   ✅ Updated department HOD');

          // Make HOD the default role for this user
          // First, clear all existing default flags
          await tx.userRole.updateMany({
            where: { userId: principalUser.user.id },
            data: { isDefault: false }
          });
          await tx.userDepartmentRole.updateMany({
            where: { userId: principalUser.user.id },
            data: { isDefault: false }
          });

          // Check if user already has HOD role in userRoles
          const existingHodUserRole = await tx.userRole.findFirst({
            where: {
              userId: principalUser.user.id,
              roleId: hodRole.id
            }
          });

          if (!existingHodUserRole) {
            // Add HOD role to userRoles
            await tx.userRole.create({
              data: {
                userId: principalUser.user.id,
                roleId: hodRole.id,
                isDefault: true
              }
            });
            console.log('   ✅ Added HOD role to userRoles table');
          } else {
            // Update existing HOD role to be default
            await tx.userRole.update({
              where: { id: existingHodUserRole.id },
              data: { isDefault: true }
            });
            console.log('   ✅ Updated existing HOD role to be default in userRoles table');
          }

          // Set HOD role as default in userDepartmentRole table
          await tx.userDepartmentRole.updateMany({
            where: {
              userId: principalUser.user.id,
              departmentId: topManagementDept.id,
              roleId: hodRole.id
            },
            data: { isDefault: true }
          });
          console.log('   ✅ Set HOD as default role in both userRole and userDepartmentRole tables');

          // If there was a previous HOD, demote them to STAFF
          if (topManagementDept.hodId && topManagementDept.hodId !== principalUser.user.id) {
            const staffRole = await tx.role.findFirst({
              where: {
                name: 'STAFF',
                tenantId: principalRole.tenantId
              }
            });

            if (staffRole) {
              // Remove HOD role from previous HOD
              await tx.userDepartmentRole.deleteMany({
                where: {
                  userId: topManagementDept.hodId,
                  departmentId: topManagementDept.id,
                  roleId: hodRole.id
                }
              });

              // Add STAFF role to previous HOD
              await tx.userDepartmentRole.create({
                data: {
                  userId: topManagementDept.hodId,
                  departmentId: topManagementDept.id,
                  roleId: staffRole.id,
                  isPrimaryDepartment: false,
                  isPrimaryRole: false
                }
              });

              console.log(`   ✅ Demoted previous HOD (${topManagementDept.hodId}) to STAFF role`);
            }
          }
        });

        console.log('   ✅ Successfully processed PRINCIPAL user');

      } catch (error) {
        console.error(`   ❌ Error processing PRINCIPAL user:`, error);
      }
    }

    // 6. Verify the changes
    console.log('\n6. 🔍 Verifying changes...');
    const updatedDept = await prisma.department.findUnique({
      where: { id: topManagementDept.id },
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

    if (updatedDept?.hod) {
      console.log(`✅ Top Management department HOD: ${updatedDept.hod.firstName} ${updatedDept.hod.lastName} (${updatedDept.hod.email})`);
    } else {
      console.log('❌ No HOD assigned to Top Management department');
    }

    // Check default roles for PRINCIPAL users
    for (const principalUser of principalUsers) {
      const userWithRoles = await prisma.user.findUnique({
        where: { id: principalUser.user.id },
        include: {
          userRoles: {
            include: {
              role: true
            }
          },
          userDepartmentRoles: {
            include: {
              role: true,
              department: true
            }
          }
        }
      });

      const defaultUserRole = userWithRoles.userRoles.find(ur => ur.isDefault);
      const defaultDeptRole = userWithRoles.userDepartmentRoles.find(udr => udr.isDefault);

      console.log(`\n👤 ${principalUser.user.firstName} ${principalUser.user.lastName}:`);
      console.log(`   Default User Role: ${defaultUserRole ? defaultUserRole.role.name : 'None'}`);
      console.log(`   Default Department Role: ${defaultDeptRole ? `${defaultDeptRole.role.name} (${defaultDeptRole.department.name})` : 'None'}`);
    }

    console.log('\n✅ PRINCIPAL to HOD assignment completed successfully!');

  } catch (error) {
    console.error('❌ Error assigning PRINCIPAL as HOD:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the assignment
assignPrincipalAsHod(); 