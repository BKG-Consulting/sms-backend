#!/usr/bin/env node

const { prisma } = require('../prisma/client');

async function testMRNotification() {
  console.log('🔍 [MR_TEST] Starting MR notification test...\n');

  try {
    // 1. Check if MR role exists
    console.log('🔍 Step 1: Checking for MR role...');
    const mrRole = await prisma.role.findFirst({
      where: { 
        name: 'MR',
        tenantId: 'ebfa3128-8eb5-4e0e-bdc5-bae82f0e7463' // RTVC tenant
      }
    });

    console.log('📋 MR Role Details:', {
      found: !!mrRole,
      roleId: mrRole?.id,
      roleName: mrRole?.name,
      tenantId: mrRole?.tenantId
    });

    if (!mrRole) {
      console.error('❌ MR role not found! This is the problem.');
      return;
    }

    // 2. Check if any user has MR role
    console.log('\n🔍 Step 2: Checking for users with MR role...');
    const mrUsers = await prisma.user.findMany({
      where: {
        tenantId: 'ebfa3128-8eb5-4e0e-bdc5-bae82f0e7463',
        OR: [
          { userRoles: { some: { roleId: mrRole.id } } },
          { userDepartmentRoles: { some: { roleId: mrRole.id } } }
        ]
      },
      include: {
        userRoles: {
          include: { role: true }
        },
        userDepartmentRoles: {
          include: { role: true }
        }
      }
    });

    console.log('📋 MR Users Found:', {
      count: mrUsers.length,
      users: mrUsers.map(user => ({
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        userRoles: user.userRoles.map(ur => ur.role.name),
        userDepartmentRoles: user.userDepartmentRoles.map(udr => udr.role.name)
      }))
    });

    if (mrUsers.length === 0) {
      console.error('❌ No users found with MR role! This is the problem.');
      
      // 3. List all users in the tenant to see what roles exist
      console.log('\n🔍 Step 3: Listing all users in tenant to see available roles...');
      const allUsers = await prisma.user.findMany({
        where: {
          tenantId: 'ebfa3128-8eb5-4e0e-bdc5-bae82f0e7463'
        },
        include: {
          userRoles: {
            include: { role: true }
          },
          userDepartmentRoles: {
            include: { role: true }
          }
        }
      });

      console.log('📋 All Users in Tenant:', {
        count: allUsers.length,
        users: allUsers.map(user => ({
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          userRoles: user.userRoles.map(ur => ur.role.name),
          userDepartmentRoles: user.userDepartmentRoles.map(udr => udr.role.name)
        }))
      });

      // 4. List all roles in the tenant
      console.log('\n🔍 Step 4: Listing all roles in tenant...');
      const allRoles = await prisma.role.findMany({
        where: {
          tenantId: 'ebfa3128-8eb5-4e0e-bdc5-bae82f0e7463'
        }
      });

      console.log('📋 All Roles in Tenant:', {
        count: allRoles.length,
        roles: allRoles.map(role => ({
          id: role.id,
          name: role.name,
          description: role.description
        }))
      });

      return;
    }

    // 5. Test the specific corrective action
    console.log('\n🔍 Step 5: Testing specific corrective action...');
    const correctiveAction = await prisma.correctiveAction.findUnique({
      where: { id: 'bc3d8e4a-d70f-4f06-b875-565df644a9c1' },
      include: {
        nonConformity: {
          include: {
            finding: {
              include: {
                audit: {
                  include: {
                    auditProgram: true
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log('📋 Corrective Action Details:', {
      found: !!correctiveAction,
      id: correctiveAction?.id,
      status: correctiveAction?.status,
      mrNotified: correctiveAction?.mrNotified,
      tenantId: correctiveAction?.nonConformity?.finding?.audit?.auditProgram?.tenantId
    });

    // 6. Simulate the MR lookup logic
    if (correctiveAction) {
      console.log('\n🔍 Step 6: Simulating MR lookup logic...');
      const tenantId = correctiveAction.nonConformity?.finding?.audit?.auditProgram?.tenantId;
      
      if (tenantId) {
        const simulatedMRUser = await prisma.user.findFirst({
          where: {
            tenantId,
            OR: [
              { userRoles: { some: { roleId: mrRole.id } } },
              { userDepartmentRoles: { some: { roleId: mrRole.id } } }
            ]
          },
          include: {
            userRoles: {
              include: { role: true }
            },
            userDepartmentRoles: {
              include: { role: true }
            }
          }
        });

        console.log('📋 Simulated MR Lookup Result:', {
          found: !!simulatedMRUser,
          userId: simulatedMRUser?.id,
          email: simulatedMRUser?.email,
          name: simulatedMRUser ? `${simulatedMRUser.firstName} ${simulatedMRUser.lastName}` : null,
          userRoles: simulatedMRUser?.userRoles?.map(ur => ur.role.name),
          userDepartmentRoles: simulatedMRUser?.userDepartmentRoles?.map(udr => udr.role.name)
        });
      }
    }

  } catch (error) {
    console.error('❌ Error during MR notification test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testMRNotification()
  .then(() => {
    console.log('\n✅ MR notification test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ MR notification test failed:', error);
    process.exit(1);
  }); 