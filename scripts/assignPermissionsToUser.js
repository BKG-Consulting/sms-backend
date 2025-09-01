const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuration - Update these values
const USER_EMAIL = 'test07@nachutvc.ac.ke'; // Replace with your email
const PERMISSIONS_TO_ASSIGN = [
  'documentChangeRequest:apply',
  'documentChangeRequest:reject',
  'permission:manage',
  'permission:read'
];

async function assignPermissionsToUser() {
  try {
    console.log('🚀 Starting permission assignment...');
    
    // Find the user by email
    const user = await prisma.user.findFirst({
      where: { email: USER_EMAIL },
      include: {
        userRoles: {
          include: {
            role: true
          }
        },
        userDepartmentRoles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user) {
      console.error(`❌ User with email ${USER_EMAIL} not found`);
      return;
    }

    console.log(`✅ Found user: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`   Tenant: ${user.tenantId}`);

    // Get all user's roles (both userRoles and userDepartmentRoles)
    const allRoles = [
      ...user.userRoles.map(ur => ur.role),
      ...user.userDepartmentRoles.map(udr => udr.role)
    ];

    console.log(`   Roles: ${allRoles.map(r => r.name).join(', ')}`);

    // Find the permissions to assign
    const permissions = await prisma.permission.findMany({
      where: {
        OR: PERMISSIONS_TO_ASSIGN.map(perm => {
          const [module, action] = perm.split(':');
          return { module, action };
        })
      }
    });

    console.log(`\n📋 Found ${permissions.length} permissions to assign:`);
    permissions.forEach(p => console.log(`   - ${p.module}:${p.action}`));

    let assignedCount = 0;
    let skippedCount = 0;

    // Assign permissions to each role
    for (const role of allRoles) {
      console.log(`\n🔧 Processing role: ${role.name}`);
      
      for (const permission of permissions) {
        // Check if permission is already assigned to this role
        const existingRolePermission = await prisma.rolePermission.findFirst({
          where: {
            roleId: role.id,
            permissionId: permission.id
          }
        });

        if (existingRolePermission) {
          if (existingRolePermission.allowed) {
            console.log(`   ⏭️  ${permission.module}:${permission.action} - already assigned`);
            skippedCount++;
          } else {
            // Update to allow the permission
            await prisma.rolePermission.update({
              where: { id: existingRolePermission.id },
              data: { allowed: true }
            });
            console.log(`   ✅ ${permission.module}:${permission.action} - updated to allowed`);
            assignedCount++;
          }
        } else {
          // Create new role permission
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permission.id,
              allowed: true
            }
          });
          console.log(`   ✅ ${permission.module}:${permission.action} - newly assigned`);
          assignedCount++;
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Assigned/Updated: ${assignedCount} permissions`);
    console.log(`   Skipped: ${skippedCount} permissions (already assigned)`);
    console.log(`   Total roles processed: ${allRoles.length}`);

    console.log(`\n🎉 Permission assignment completed!`);
    console.log(`   User: ${user.firstName} ${user.lastName}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   You can now test the new permissions in the application.`);

  } catch (error) {
    console.error('❌ Error assigning permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
assignPermissionsToUser(); 