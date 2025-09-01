const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAuditProgramApprovePermission() {
  try {
    console.log('🔍 Checking Audit Program Approve Permission Distribution...');
    
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
    
    // 2. Get Aurora tenant
    console.log('\n🏢 Getting Aurora tenant...');
    
    const auroraTenant = await prisma.tenant.findFirst({
      where: {
        name: 'Aurora Institute of Management',
        id: '782ddc64-29b7-4ab4-9cb8-0f6a64a06082'
      }
    });
    
    if (!auroraTenant) {
      console.log('❌ Aurora tenant not found');
      return;
    }
    
    console.log(`✅ Found Aurora tenant: ${auroraTenant.name}`);
    
    // 3. Find all users with auditProgram:approve permission
    console.log('\n👥 Finding users with auditProgram:approve permission...');
    
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
      console.log('❌ No users have auditProgram:approve permission!');
      console.log('\n🔧 This means NO ONE will receive notifications when audit programs are committed for approval.');
      console.log('\n💡 You should assign this permission to appropriate roles (e.g., SYSTEM_ADMIN, Principal, etc.)');
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
    
    // 4. Check which roles have this permission
    console.log('\n🔧 Checking which roles have auditProgram:approve permission...');
    
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
      console.log('❌ No roles have auditProgram:approve permission!');
    } else {
      rolesWithPermission.forEach(role => {
        console.log(`   ✅ ${role.name} (${role.id})`);
      });
    }
    
    // 5. Summary and recommendations
    console.log('\n📋 Summary:');
    console.log(`   - Permission: ${approvePermission.module}:${approvePermission.action}`);
    console.log(`   - Users with permission: ${usersWithPermission.length}`);
    console.log(`   - Roles with permission: ${rolesWithPermission.length}`);
    
    if (usersWithPermission.length === 0) {
      console.log('\n⚠️  WARNING: No users will receive audit program approval notifications!');
      console.log('\n🔧 Recommendations:');
      console.log('   1. Assign auditProgram:approve permission to SYSTEM_ADMIN role');
      console.log('   2. Assign auditProgram:approve permission to Principal role');
      console.log('   3. Or assign to any other appropriate role that should approve audit programs');
    } else {
      console.log('\n✅ Audit program approval notifications will be sent to the users listed above.');
    }
    
  } catch (error) {
    console.error('❌ Error checking audit program approve permission:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkAuditProgramApprovePermission(); 