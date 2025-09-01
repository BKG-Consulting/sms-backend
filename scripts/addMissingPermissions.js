const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Define missing permissions that need to be added
const missingPermissions = [
  {
    module: 'documentChangeRequest',
    action: 'apply',
    description: 'Apply approved change requests to documents'
  },
  {
    module: 'documentChangeRequest',
    action: 'reject',
    description: 'Reject change requests'
  },
  {
    module: 'Opening Meeting',
    action: 'attend',
    description: 'Attend opening meetings'
  },
  {
    module: 'Opening Meeting',
    action: 'update',
    description: 'Update opening meetings'
  },
  {
    module: 'Opening Meeting',
    action: 'create',
    description: 'Create opening meetings'
  },
  {
    module: 'permission',
    action: 'manage',
    description: 'Manage system permissions'
  },
  {
    module: 'permission',
    action: 'read',
    description: 'View system permissions'
  },
  {
    module: 'auditProgram',
    action: 'commit',
    description: 'Commit audit program for review'
  },
  // Finding Management Permissions
  {
    module: 'finding',
    action: 'create',
    description: 'Create new audit findings'
  },
  {
    module: 'finding',
    action: 'read',
    description: 'View audit findings'
  },
  {
    module: 'finding',
    action: 'update',
    description: 'Update audit findings'
  },
  {
    module: 'finding',
    action: 'delete',
    description: 'Delete audit findings'
  },
  {
    module: 'finding',
    action: 'commit',
    description: 'Commit findings for review'
  },
  {
    module: 'finding',
    action: 'review',
    description: 'Review findings (HOD review)'
  },
  {
    module: 'finding',
    action: 'categorize',
    description: 'Categorize findings (non-conformity, compliance, improvement)'
  },
  {
    module: 'finding',
    action: 'manage',
    description: 'Manage all findings (full access)'
  },
  // Closing Meeting Permissions
  {
    module: 'Closing Meeting',
    action: 'create',
    description: 'Create closing meetings'
  },
  {
    module: 'Closing Meeting',
    action: 'read',
    description: 'View closing meetings'
  },
  {
    module: 'Closing Meeting',
    action: 'update',
    description: 'Update closing meetings'
  },
  {
    module: 'Closing Meeting',
    action: 'attend',
    description: 'Attend closing meetings'
  },
  // Feedback Response Permission
  {
    module: 'feedback',
    action: 'respond',
    description: 'Respond to feedback submissions'
  }
];

async function addMissingPermissions() {
  try {
    console.log('🚀 Starting to add missing permissions...');
    
    let addedCount = 0;
    let skippedCount = 0;

    for (const permissionData of missingPermissions) {
      // Check if permission already exists
      const existingPermission = await prisma.permission.findFirst({
        where: {
          module: permissionData.module,
          action: permissionData.action
        }
      });

      if (existingPermission) {
        console.log(`⏭️  Skipping ${permissionData.module}:${permissionData.action} - already exists`);
        skippedCount++;
        continue;
      }

      // Create the permission
      const permission = await prisma.permission.create({
        data: {
          module: permissionData.module,
          action: permissionData.action,
          description: permissionData.description
        }
      });

      console.log(`✅ Created permission: ${permission.module}:${permission.action}`);
      addedCount++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Added: ${addedCount} permissions`);
    console.log(`   Skipped: ${skippedCount} permissions (already existed)`);
    console.log(`   Total processed: ${missingPermissions.length}`);

    if (addedCount > 0) {
      console.log('\n🔧 Next steps:');
      console.log('   1. Assign the new permissions to appropriate roles');
      console.log('   2. Test the permissions in the application');
      console.log('   3. Update role templates if needed');
    }

  } catch (error) {
    console.error('❌ Error adding missing permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addMissingPermissions(); 