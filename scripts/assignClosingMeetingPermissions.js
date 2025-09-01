const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function assignClosingMeetingPermissions() {
  try {
    console.log('🚀 Starting to assign closing meeting permissions to tenant roles...');
    
    // Find tenant-scoped roles: HOD, AUDITOR, HOD AUDITOR
    const targetRoles = await prisma.role.findMany({
      where: {
        name: {
          in: ['HOD', 'AUDITOR', 'HOD AUDITOR']
        }
      }
    });

    if (targetRoles.length === 0) {
      console.error('❌ No target roles (HOD, AUDITOR, HOD AUDITOR) found');
      return;
    }

    console.log(`✅ Found ${targetRoles.length} target roles:`);
    targetRoles.forEach(role => {
      console.log(`   - ${role.name} (${role.id})`);
    });

    // Get all closing meeting permissions
    const closingMeetingPermissions = await prisma.permission.findMany({
      where: {
        module: 'Closing Meeting'
      }
    });

    if (closingMeetingPermissions.length === 0) {
      console.error('❌ No closing meeting permissions found');
      return;
    }

    console.log(`✅ Found ${closingMeetingPermissions.length} closing meeting permissions`);

    let totalAddedCount = 0;
    let totalSkippedCount = 0;

    for (const role of targetRoles) {
      console.log(`\n📋 Processing role: ${role.name}`);
      let roleAddedCount = 0;
      let roleSkippedCount = 0;

      for (const permission of closingMeetingPermissions) {
        // Check if permission is already assigned to this role
        const existingRolePermission = await prisma.rolePermission.findFirst({
          where: {
            roleId: role.id,
            permissionId: permission.id
          }
        });

        if (existingRolePermission) {
          console.log(`⏭️  Skipping ${permission.module}:${permission.action} - already assigned to ${role.name}`);
          roleSkippedCount++;
          totalSkippedCount++;
          continue;
        }

        // Assign permission to this role
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
            allowed: true
          }
        });

        console.log(`✅ Assigned ${permission.module}:${permission.action} to ${role.name}`);
        roleAddedCount++;
        totalAddedCount++;
      }

      console.log(`📊 ${role.name}: Added ${roleAddedCount}, Skipped ${roleSkippedCount}`);
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total Added: ${totalAddedCount} permissions across all roles`);
    console.log(`   Total Skipped: ${totalSkippedCount} permissions (already assigned)`);
    console.log(`   Total Processed: ${closingMeetingPermissions.length * targetRoles.length}`);

    if (totalAddedCount > 0) {
      console.log('\n🔧 Next steps:');
      console.log('   1. Test the closing meeting page with users having HOD, AUDITOR, or HOD AUDITOR roles');
      console.log('   2. Verify that users can now see and interact with closing meetings');
    }

  } catch (error) {
    console.error('❌ Error assigning closing meeting permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
assignClosingMeetingPermissions(); 