const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignFeedbackRespondPermission() {
  try {
    console.log('🚀 Starting to assign feedback:respond permission to roles...');
    
    // Get the feedback:respond permission
    const feedbackRespondPermission = await prisma.permission.findFirst({
      where: {
        module: 'feedback',
        action: 'respond'
      }
    });

    if (!feedbackRespondPermission) {
      console.log('❌ feedback:respond permission not found. Please run the addMissingPermissions script first.');
      return;
    }

    console.log(`✅ Found feedback:respond permission (ID: ${feedbackRespondPermission.id})`);

    // Roles that should have feedback:respond permission
    const rolesToAssign = ['HOD', 'PRINCIPAL', 'ADMIN', 'MR'];
    
    let assignedCount = 0;
    let skippedCount = 0;

    for (const roleName of rolesToAssign) {
      // Find the role
      const role = await prisma.role.findFirst({
        where: { name: roleName }
      });

      if (!role) {
        console.log(`⚠️  Role '${roleName}' not found, skipping...`);
        continue;
      }

      // Check if permission is already assigned
      const existingRolePermission = await prisma.rolePermission.findFirst({
        where: {
          roleId: role.id,
          permissionId: feedbackRespondPermission.id
        }
      });

      if (existingRolePermission) {
        console.log(`⏭️  Role '${roleName}' already has feedback:respond permission`);
        skippedCount++;
        continue;
      }

      // Assign the permission
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: feedbackRespondPermission.id,
          allowed: true
        }
      });

      console.log(`✅ Assigned feedback:respond permission to role '${roleName}'`);
      assignedCount++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Assigned: ${assignedCount} roles`);
    console.log(`   Skipped: ${skippedCount} roles (already had permission)`);
    console.log(`   Total processed: ${rolesToAssign.length}`);

    if (assignedCount > 0) {
      console.log('\n🔧 Next steps:');
      console.log('   1. Test the feedback notification system');
      console.log('   2. Verify that HODs and Principals receive feedback notifications');
      console.log('   3. Check that notifications are department-specific');
    }

  } catch (error) {
    console.error('❌ Error assigning feedback:respond permission:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
assignFeedbackRespondPermission(); 