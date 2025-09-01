const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixMRPublishPermission() {
  try {
    console.log('🔧 Fixing MR Publish Permission...');
    
    // 1. Add the missing document:publish permission
    console.log('\n📝 Adding missing document:publish permission...');
    
    const permissionData = {
      module: 'document',
      action: 'publish',
      description: 'Publish documents and apply changes'
    };
    
    try {
      const permission = await prisma.permission.upsert({
        where: {
          module_action: {
            module: permissionData.module,
            action: permissionData.action
          }
        },
        update: { description: permissionData.description },
        create: permissionData
      });
      
      console.log(`✅ Created/Updated permission: ${permission.module}:${permission.action}`);
    } catch (error) {
      console.error(`❌ Error creating permission ${permissionData.module}:${permissionData.action}:`, error.message);
      return;
    }

    // 2. Get the Aurora tenant and its MR role
    console.log('\n🏢 Getting Aurora tenant and MR role...');
    
    const auroraTenant = await prisma.tenant.findFirst({
      where: {
        name: 'Aurora Institute of Management',
        id: '782ddc64-29b7-4ab4-9cb8-0f6a64a06082'
      },
      include: {
        roles: {
          where: {
            name: 'MR'
          }
        }
      }
    });
    
    if (!auroraTenant) {
      console.log('❌ Aurora tenant not found');
      return;
    }
    
    console.log(`✅ Found Aurora tenant: ${auroraTenant.name}`);
    
    if (auroraTenant.roles.length === 0) {
      console.log('❌ MR role not found in Aurora tenant');
      return;
    }
    
    const mrRole = auroraTenant.roles[0];
    console.log(`✅ Found MR role: ${mrRole.name} (${mrRole.id})`);

    // 3. Find the document:publish permission
    console.log('\n🔍 Finding document:publish permission...');
    
    const publishPermission = await prisma.permission.findFirst({
      where: {
        module: 'document',
        action: 'publish'
      }
    });
    
    if (!publishPermission) {
      console.log('❌ document:publish permission not found');
      return;
    }
    
    console.log(`✅ Found permission: ${publishPermission.module}:${publishPermission.action}`);

    // 4. Check if MR role already has this permission
    console.log('\n🔍 Checking if MR role already has document:publish permission...');
    
    const existingRolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: mrRole.id,
        permissionId: publishPermission.id
      }
    });
    
    if (existingRolePermission) {
      console.log('⏭️  MR role already has document:publish permission');
    } else {
      // 5. Assign the permission to MR role
      console.log('\n📋 Assigning document:publish permission to MR role...');
      
      try {
        await prisma.rolePermission.create({
          data: {
            roleId: mrRole.id,
            permissionId: publishPermission.id,
            allowed: true
          }
        });
        
        console.log('✅ Successfully assigned document:publish permission to MR role');
      } catch (error) {
        console.error('❌ Error assigning permission to MR role:', error.message);
        return;
      }
    }

    // 6. Verify the MR user has the permission
    console.log('\n👤 Verifying MR user permissions...');
    
    const mrUser = await prisma.user.findFirst({
      where: {
        email: 'mr@aurorainstitute.ac.ke',
        tenantId: auroraTenant.id
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (mrUser) {
      console.log(`✅ Found MR user: ${mrUser.firstName} ${mrUser.lastName}`);
      
      const userPermissions = new Set();
      mrUser.userRoles.forEach(userRole => {
        userRole.role.rolePermissions.forEach(rp => {
          if (rp.allowed) {
            userPermissions.add(`${rp.permission.module}:${rp.permission.action}`);
          }
        });
      });
      
      const hasPublishPermission = userPermissions.has('document:publish');
      console.log(`   ${hasPublishPermission ? '✅' : '❌'} User has document:publish permission: ${hasPublishPermission}`);
      
      if (hasPublishPermission) {
        console.log('   📋 User permissions:');
        Array.from(userPermissions).sort().forEach(perm => {
          console.log(`      ✅ ${perm}`);
        });
      }
    } else {
      console.log('❌ MR user not found');
    }

    console.log('\n🎉 MR publish permission fix completed!');
    console.log('\n📊 Summary:');
    console.log(`   - Added document:publish permission`);
    console.log(`   - Assigned to MR role in Aurora tenant`);
    console.log(`   - MR user should now receive change request approval notifications`);
    
    console.log('\n🔍 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Test a change request approval');
    console.log('   3. MR user should now receive notifications');

  } catch (error) {
    console.error('❌ Error fixing MR publish permission:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixMRPublishPermission(); 