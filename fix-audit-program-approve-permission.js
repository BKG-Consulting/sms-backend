const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAuditProgramApprovePermission() {
  try {
    console.log('🔧 Fixing Audit Program Approve Permission Distribution...');
    
    // 1. Find the auditProgram:approve permission
    console.log('\n📋 Finding auditProgram:approve permission...');
    
    const approvePermission = await prisma.permission.findFirst({
      where: {
        module: 'auditProgram',
        action: 'approve'
      }
    });
    
    if (!approvePermission) {
      console.log('❌ auditProgram:approve permission not found');
      return;
    }
    
    console.log(`✅ Found permission: ${approvePermission.module}:${approvePermission.action}`);
    
    // 2. Get Aurora tenant and its roles
    console.log('\n🏢 Getting Aurora tenant and roles...');
    
    const auroraTenant = await prisma.tenant.findFirst({
      where: {
        name: 'Aurora Institute of Management',
        id: '782ddc64-29b7-4ab4-9cb8-0f6a64a06082'
      },
      include: {
        roles: {
          include: {
            rolePermissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });
    
    if (!auroraTenant) {
      console.log('❌ Aurora tenant not found');
      return;
    }
    
    console.log(`✅ Found Aurora tenant: ${auroraTenant.name}`);
    
    // 3. Define which roles should have audit program approval permission
    const rolesToAssign = ['PRINCIPAL'];
    
    console.log(`\n🔧 Assigning auditProgram:approve permission to roles: ${rolesToAssign.join(', ')}`);
    
    for (const roleName of rolesToAssign) {
      const role = auroraTenant.roles.find(r => r.name === roleName);
      
      if (!role) {
        console.log(`⚠️  Role ${roleName} not found in Aurora tenant`);
        continue;
      }
      
      console.log(`\n📋 Processing role: ${role.name} (${role.id})`);
      
      // Check if role already has this permission
      const existingPermission = role.rolePermissions.find(rp => 
        rp.permissionId === approvePermission.id && rp.allowed
      );
      
      if (existingPermission) {
        console.log(`   ⏭️  Role ${role.name} already has auditProgram:approve permission`);
      } else {
        // Assign the permission to the role
        try {
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: approvePermission.id,
              allowed: true
            }
          });
          
          console.log(`   ✅ Successfully assigned auditProgram:approve permission to ${role.name} role`);
        } catch (error) {
          console.error(`   ❌ Error assigning permission to ${role.name} role:`, error.message);
        }
      }
    }
    
    // 4. Verify the changes by checking users with the permission
    console.log('\n👥 Verifying users with auditProgram:approve permission...');
    
    const usersWithPermission = await prisma.user.findMany({
      where: {
        tenantId: auroraTenant.id,
        OR: [
          {
            userRoles: {
              some: {
                role: {
                  rolePermissions: {
                    some: {
                      permissionId: approvePermission.id,
                      allowed: true
                    }
                  }
                }
              }
            }
          },
          {
            userDepartmentRoles: {
              some: {
                role: {
                  rolePermissions: {
                    some: {
                      permissionId: approvePermission.id,
                      allowed: true
                    }
                  }
                }
              }
            }
          }
        ]
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
        },
        userDepartmentRoles: {
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
    
    console.log(`\n📊 Found ${usersWithPermission.length} users with auditProgram:approve permission:`);
    
    if (usersWithPermission.length === 0) {
      console.log('❌ Still no users have auditProgram:approve permission!');
      console.log('\n🔧 This might be because:');
      console.log('   1. No users are assigned to PRINCIPAL role');
      console.log('   2. Users need to be assigned to PRINCIPAL role first');
    } else {
      usersWithPermission.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.firstName} ${user.lastName} (${user.email})`);
        
        // Check user roles
        const userRoles = [];
        user.userRoles.forEach(ur => {
          userRoles.push(ur.role.name);
        });
        user.userDepartmentRoles.forEach(udr => {
          userRoles.push(udr.role.name);
        });
        
        console.log(`   Roles: ${userRoles.join(', ')}`);
        console.log(`   User ID: ${user.id}`);
      });
    }
    
    // 5. Check which roles now have this permission
    console.log('\n🔧 Checking which roles now have auditProgram:approve permission...');
    
    const rolesWithPermission = await prisma.role.findMany({
      where: {
        tenantId: auroraTenant.id,
        rolePermissions: {
          some: {
            permissionId: approvePermission.id,
            allowed: true
          }
        }
      },
      include: {
        rolePermissions: {
          where: {
            permissionId: approvePermission.id,
            allowed: true
          },
          include: {
            permission: true
          }
        }
      }
    });
    
    console.log(`\n📋 Roles with auditProgram:approve permission:`);
    
    if (rolesWithPermission.length === 0) {
      console.log('❌ Still no roles have auditProgram:approve permission!');
    } else {
      rolesWithPermission.forEach(role => {
        console.log(`   ✅ ${role.name} (${role.id})`);
      });
    }
    
    // 6. Summary
    console.log('\n📋 Summary:');
    console.log(`   - Permission: ${approvePermission.module}:${approvePermission.action}`);
    console.log(`   - Users with permission: ${usersWithPermission.length}`);
    console.log(`   - Roles with permission: ${rolesWithPermission.length}`);
    
    if (usersWithPermission.length > 0) {
      console.log('\n✅ SUCCESS: Audit program approval notifications will now be sent to the users listed above.');
      console.log('\n📢 When an audit program is committed for approval:');
      console.log('   1. The system will find all users with auditProgram:approve permission');
      console.log('   2. Send notifications to those users');
      console.log('   3. Users can then approve or reject the audit program');
    } else {
      console.log('\n⚠️  WARNING: Still no users will receive audit program approval notifications!');
      console.log('\n🔧 Next steps:');
      console.log('   1. Assign users to PRINCIPAL role');
      console.log('   2. Or assign users to roles that have auditProgram:approve permission');
    }
    
  } catch (error) {
    console.error('❌ Error fixing audit program approve permission:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixAuditProgramApprovePermission(); 