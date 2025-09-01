const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixChangeRequestPermissions() {
  try {
    console.log('🔧 Fixing Change Request Permissions...');
    
    // 1. Add missing permissions
    const missingPermissions = [
      {
        module: 'documentChangeRequest',
        action: 'reject',
        description: 'Reject change requests'
      },
      {
        module: 'documentChangeRequest',
        action: 'apply',
        description: 'Apply approved change requests to documents'
      }
    ];

    console.log('\n📝 Adding missing permissions...');
    const createdPermissions = {};
    
    for (const permData of missingPermissions) {
      try {
        const permission = await prisma.permission.upsert({
          where: {
            module_action: {
              module: permData.module,
              action: permData.action
            }
          },
          update: { description: permData.description },
          create: permData
        });
        
        createdPermissions[`${permData.module}:${permData.action}`] = permission;
        console.log(`✅ Created/Updated permission: ${permData.module}:${permData.action}`);
      } catch (error) {
        console.error(`❌ Error creating permission ${permData.module}:${permData.action}:`, error.message);
      }
    }

    // 2. Get all tenants and their roles
    console.log('\n🏢 Getting all tenants and their roles...');
    const tenants = await prisma.tenant.findMany({
      include: {
        roles: {
          orderBy: { name: 'asc' }
        }
      }
    });

    console.log(`Found ${tenants.length} tenants`);

    // 3. For each tenant, assign permissions to appropriate roles
    for (const tenant of tenants) {
      console.log(`\n📋 Processing tenant: ${tenant.name} (${tenant.id})`);
      console.log(`   Roles in this tenant: ${tenant.roles.map(r => r.name).join(', ')}`);
      
      // Get roles that should have change request permissions
      const hodRoles = tenant.roles.filter(role => 
        role.name === 'HOD' || role.name === 'HOD AUDITOR'
      );
      
      const mrRoles = tenant.roles.filter(role => 
        role.name === 'MR'
      );
      
      const adminRoles = tenant.roles.filter(role => 
        role.name === 'ADMIN' || role.name === 'SYSTEM_ADMIN' || role.name === 'SUPER_ADMIN'
      );

      console.log(`   HOD roles: ${hodRoles.map(r => r.name).join(', ')}`);
      console.log(`   MR roles: ${mrRoles.map(r => r.name).join(', ')}`);
      console.log(`   Admin roles: ${adminRoles.map(r => r.name).join(', ')}`);

      // Assign permissions to HOD roles
      for (const role of hodRoles) {
        console.log(`\n   📋 Processing HOD role: ${role.name}`);
        
        const permissionsToAssign = [
          'documentChangeRequest:approve',
          'documentChangeRequest:reject'
        ];
        
        console.log(`      Assigning permissions: ${permissionsToAssign.join(', ')}`);
        
        for (const permissionString of permissionsToAssign) {
          const [module, action] = permissionString.split(':');
          
          try {
            // Find the permission
            const permission = await prisma.permission.findFirst({
              where: { module, action }
            });
            
            if (!permission) {
              console.log(`      ⚠️  Permission ${permissionString} not found, skipping`);
              continue;
            }
            
            // Check if role permission already exists
            const existingRolePermission = await prisma.rolePermission.findFirst({
              where: {
                roleId: role.id,
                permissionId: permission.id
              }
            });
            
            if (existingRolePermission) {
              console.log(`      ⏭️  Role permission ${permissionString} already exists`);
            } else {
              // Create role permission
              await prisma.rolePermission.create({
                data: {
                  roleId: role.id,
                  permissionId: permission.id,
                  allowed: true
                }
              });
              console.log(`      ✅ Assigned ${permissionString} to ${role.name}`);
            }
          } catch (error) {
            console.error(`      ❌ Error assigning ${permissionString} to ${role.name}:`, error.message);
          }
        }
      }

      // Assign permissions to MR roles
      for (const role of mrRoles) {
        console.log(`\n   📋 Processing MR role: ${role.name}`);
        
        const permissionsToAssign = ['documentChangeRequest:apply'];
        
        console.log(`      Assigning permissions: ${permissionsToAssign.join(', ')}`);
        
        for (const permissionString of permissionsToAssign) {
          const [module, action] = permissionString.split(':');
          
          try {
            // Find the permission
            const permission = await prisma.permission.findFirst({
              where: { module, action }
            });
            
            if (!permission) {
              console.log(`      ⚠️  Permission ${permissionString} not found, skipping`);
              continue;
            }
            
            // Check if role permission already exists
            const existingRolePermission = await prisma.rolePermission.findFirst({
              where: {
                roleId: role.id,
                permissionId: permission.id
              }
            });
            
            if (existingRolePermission) {
              console.log(`      ⏭️  Role permission ${permissionString} already exists`);
            } else {
              // Create role permission
              await prisma.rolePermission.create({
                data: {
                  roleId: role.id,
                  permissionId: permission.id,
                  allowed: true
                }
              });
              console.log(`      ✅ Assigned ${permissionString} to ${role.name}`);
            }
          } catch (error) {
            console.error(`      ❌ Error assigning ${permissionString} to ${role.name}:`, error.message);
          }
        }
      }

      // Assign permissions to Admin roles
      for (const role of adminRoles) {
        console.log(`\n   📋 Processing Admin role: ${role.name}`);
        
        const permissionsToAssign = [
          'documentChangeRequest:approve',
          'documentChangeRequest:reject',
          'documentChangeRequest:apply'
        ];
        
        console.log(`      Assigning permissions: ${permissionsToAssign.join(', ')}`);
        
        for (const permissionString of permissionsToAssign) {
          const [module, action] = permissionString.split(':');
          
          try {
            // Find the permission
            const permission = await prisma.permission.findFirst({
              where: { module, action }
            });
            
            if (!permission) {
              console.log(`      ⚠️  Permission ${permissionString} not found, skipping`);
              continue;
            }
            
            // Check if role permission already exists
            const existingRolePermission = await prisma.rolePermission.findFirst({
              where: {
                roleId: role.id,
                permissionId: permission.id
              }
            });
            
            if (existingRolePermission) {
              console.log(`      ⏭️  Role permission ${permissionString} already exists`);
            } else {
              // Create role permission
              await prisma.rolePermission.create({
                data: {
                  roleId: role.id,
                  permissionId: permission.id,
                  allowed: true
                }
              });
              console.log(`      ✅ Assigned ${permissionString} to ${role.name}`);
            }
          } catch (error) {
            console.error(`      ❌ Error assigning ${permissionString} to ${role.name}:`, error.message);
          }
        }
      }
    }

    console.log('\n🎉 Change request permissions fix completed!');
    console.log('\n📊 Summary:');
    console.log(`   - Created/Updated ${Object.keys(createdPermissions).length} permissions`);
    console.log(`   - Processed ${tenants.length} tenants`);
    
    console.log('\n🔍 Next steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Refresh the frontend page');
    console.log('   3. Check the change request page - approve/reject buttons should now appear');
    console.log('   4. Test the permissions work correctly');

  } catch (error) {
    console.error('❌ Error fixing change request permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixChangeRequestPermissions(); 