const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addApplyPermission() {
  try {
    console.log('🔧 Adding Missing Apply Permission...');
    
    // 1. Add the missing documentChangeRequest:apply permission
    console.log('\n📝 Adding missing documentChangeRequest:apply permission...');
    
    const permissionData = {
      module: 'documentChangeRequest',
      action: 'apply',
      description: 'Apply approved change requests to documents'
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

    // 3. Find the documentChangeRequest:apply permission
    console.log('\n🔍 Finding documentChangeRequest:apply permission...');
    
    const applyPermission = await prisma.permission.findFirst({
      where: {
        module: 'documentChangeRequest',
        action: 'apply'
      }
    });
    
    if (!applyPermission) {
      console.log('❌ documentChangeRequest:apply permission not found');
      return;
    }
    
    console.log(`✅ Found permission: ${applyPermission.module}:${applyPermission.action}`);

    // 4. Check if MR role already has this permission
    console.log('\n🔍 Checking if MR role already has documentChangeRequest:apply permission...');
    
    const existingRolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: mrRole.id,
        permissionId: applyPermission.id
      }
    });
    
    if (existingRolePermission) {
      console.log('⏭️  MR role already has documentChangeRequest:apply permission');
    } else {
      // 5. Assign the permission to MR role
      console.log('\n📋 Assigning documentChangeRequest:apply permission to MR role...');
      
      try {
        await prisma.rolePermission.create({
          data: {
            roleId: mrRole.id,
            permissionId: applyPermission.id,
            allowed: true
          }
        });
        
        console.log('✅ Successfully assigned documentChangeRequest:apply permission to MR role');
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
      
      const hasApplyPermission = userPermissions.has('documentChangeRequest:apply');
      console.log(`   ${hasApplyPermission ? '✅' : '❌'} User has documentChangeRequest:apply permission: ${hasApplyPermission}`);
      
      // Check all change request permissions
      const changeRequestPermissions = Array.from(userPermissions).filter(p => p.startsWith('documentChangeRequest:'));
      console.log('\n📋 Change Request Permissions:');
      changeRequestPermissions.forEach(perm => {
        console.log(`   ✅ ${perm}`);
      });
      
      if (changeRequestPermissions.length === 0) {
        console.log('   ❌ No change request permissions found');
      }
    } else {
      console.log('❌ MR user not found');
    }

    console.log('\n🎉 Apply permission fix completed!');
    console.log('\n📊 Summary:');
    console.log(`   - Added documentChangeRequest:apply permission`);
    console.log(`   - Assigned to MR role in Aurora tenant`);
    console.log(`   - MR user should now see the "Apply" button for approved change requests`);
    
    console.log('\n🔍 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Refresh the frontend page');
    console.log('   3. MR user should now see the Apply button for approved change requests');
    console.log('   4. Test the apply functionality');

  } catch (error) {
    console.error('❌ Error adding apply permission:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
addApplyPermission(); 