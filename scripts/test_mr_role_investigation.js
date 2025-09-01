#!/usr/bin/env node

const { prisma } = require('../prisma/client');

async function investigateMRRole() {
  console.log('🔍 [MR_INVESTIGATION] Starting MR role investigation...\n');

  const tenantId = 'ebfa3128-8eb5-4e0e-bdc5-bae82f0e7463'; // RTVC tenant from logs

  try {
    // 1. Check tenant exists
    console.log('🔍 Step 1: Checking tenant...');
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    console.log('📋 Tenant Details:', {
      found: !!tenant,
      tenantId: tenant?.id,
      tenantName: tenant?.name,
      tenantDomain: tenant?.domain
    });

    if (!tenant) {
      console.error('❌ Tenant not found!');
      return;
    }

    // 2. Check all roles in the tenant
    console.log('\n🔍 Step 2: Checking all roles in tenant...');
    const allRoles = await prisma.role.findMany({
      where: { tenantId }
    });

    console.log('📋 All Roles in Tenant:', {
      count: allRoles.length,
      roles: allRoles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        isDefault: role.isDefault
      }))
    });

    // 3. Specifically check for MR role
    console.log('\n🔍 Step 3: Checking for MR role specifically...');
    const mrRole = await prisma.role.findFirst({
      where: { 
        name: 'MR',
        tenantId 
      }
    });

    console.log('📋 MR Role Details:', {
      found: !!mrRole,
      roleId: mrRole?.id,
      roleName: mrRole?.name,
      description: mrRole?.description,
      tenantId: mrRole?.tenantId
    });

    if (!mrRole) {
      console.error('❌ MR role not found! This is the problem.');
      console.log('💡 Solution: Need to create MR role for this tenant');
      return;
    }

    // 4. Check if any users have MR role
    console.log('\n🔍 Step 4: Checking for users with MR role...');
    const mrUsers = await prisma.user.findMany({
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

    console.log('📋 MR Users Found:', {
      count: mrUsers.length,
      users: mrUsers.map(user => ({
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        verified: user.verified,
        userRoles: user.userRoles.map(ur => ur.role.name),
        userDepartmentRoles: user.userDepartmentRoles.map(udr => udr.role.name)
      }))
    });

    if (mrUsers.length === 0) {
      console.error('❌ No users found with MR role! This is the problem.');
      
      // 5. List all users in the tenant to see what roles exist
      console.log('\n🔍 Step 5: Listing all users in tenant to see available roles...');
      const allUsers = await prisma.user.findMany({
        where: { tenantId },
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
          verified: user.verified,
          userRoles: user.userRoles.map(ur => ur.role.name),
          userDepartmentRoles: user.userDepartmentRoles.map(udr => udr.role.name)
        }))
      });

      // 6. Check if there are any users who might be MR (by name or email pattern)
      console.log('\n🔍 Step 6: Looking for potential MR users by name/email patterns...');
      const potentialMRUsers = allUsers.filter(user => {
        const name = `${user.firstName} ${user.lastName}`.toLowerCase();
        const email = user.email.toLowerCase();
        return name.includes('mr') || 
               name.includes('management') || 
               name.includes('representative') ||
               email.includes('mr') ||
               email.includes('management') ||
               email.includes('representative');
      });

      console.log('📋 Potential MR Users (by name/email patterns):', {
        count: potentialMRUsers.length,
        users: potentialMRUsers.map(user => ({
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          verified: user.verified,
          userRoles: user.userRoles.map(ur => ur.role.name),
          userDepartmentRoles: user.userDepartmentRoles.map(udr => udr.role.name)
        }))
      });

      return;
    }

    // 7. Test the specific corrective action MR lookup
    console.log('\n🔍 Step 7: Testing specific corrective action MR lookup...');
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

    // 8. Simulate the exact MR lookup logic from the controller
    if (correctiveAction) {
      console.log('\n🔍 Step 8: Simulating exact MR lookup logic from controller...');
      const actionTenantId = correctiveAction.nonConformity?.finding?.audit?.auditProgram?.tenantId;
      
      if (actionTenantId) {
        // Simulate the exact logic from the controller
        const simulatedMRRole = await prisma.role.findFirst({
          where: { 
            name: 'MR',
            tenantId: actionTenantId
          }
        });

        console.log('📋 Simulated MR Role Lookup:', {
          found: !!simulatedMRRole,
          roleId: simulatedMRRole?.id,
          roleName: simulatedMRRole?.name,
          tenantId: simulatedMRRole?.tenantId,
          actionTenantId
        });

        if (simulatedMRRole) {
          const simulatedMRUser = await prisma.user.findFirst({
            where: {
              tenantId: actionTenantId,
              OR: [
                { userRoles: { some: { roleId: simulatedMRRole.id } } },
                { userDepartmentRoles: { some: { roleId: simulatedMRRole.id } } }
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

          console.log('📋 Simulated MR User Lookup:', {
            found: !!simulatedMRUser,
            userId: simulatedMRUser?.id,
            email: simulatedMRUser?.email,
            name: simulatedMRUser ? `${simulatedMRUser.firstName} ${simulatedMRUser.lastName}` : null,
            userRoles: simulatedMRUser?.userRoles?.map(ur => ur.role.name),
            userDepartmentRoles: simulatedMRUser?.userDepartmentRoles?.map(udr => udr.role.name)
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Error during MR role investigation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the investigation
investigateMRRole()
  .then(() => {
    console.log('\n✅ MR role investigation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ MR role investigation failed:', error);
    process.exit(1);
  }); 