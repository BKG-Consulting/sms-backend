const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAuditProgramPermissions() {
  try {
    console.log('🔍 Checking Audit Program Permissions...');
    
    // 1. Check all auditProgram permissions in the database
    console.log('\n📋 Checking all auditProgram permissions in database...');
    
    const auditProgramPermissions = await prisma.permission.findMany({
      where: {
        module: 'auditProgram'
      },
      orderBy: { action: 'asc' }
    });
    
    console.log('Found auditProgram permissions:');
    auditProgramPermissions.forEach(perm => {
      console.log(`   ✅ ${perm.module}:${perm.action} - ${perm.description}`);
    });
    
    // 2. Check if auditProgram:commit permission exists
    const commitPermission = await prisma.permission.findFirst({
      where: {
        module: 'auditProgram',
        action: 'commit'
      }
    });
    
    if (!commitPermission) {
      console.log('\n❌ auditProgram:commit permission not found - adding it...');
      
      try {
        const newPermission = await prisma.permission.create({
          data: {
            module: 'auditProgram',
            action: 'commit',
            description: 'Commit audit program for approval'
          }
        });
        
        console.log(`✅ Created permission: ${newPermission.module}:${newPermission.action}`);
      } catch (error) {
        console.error('❌ Error creating permission:', error.message);
        return;
      }
    } else {
      console.log(`✅ auditProgram:commit permission already exists`);
    }

    // 3. Get Aurora tenant and its roles
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
    
    // 4. Check role permissions for each role
    console.log('\n🔧 Checking role permissions...');
    
    auroraTenant.roles.forEach(role => {
      console.log(`\n📋 Role: ${role.name}`);
      
      const auditProgramPermissions = role.rolePermissions
        .filter(rp => rp.permission.module === 'auditProgram')
        .map(rp => ({
          permission: `${rp.permission.module}:${rp.permission.action}`,
          allowed: rp.allowed
        }));
      
      if (auditProgramPermissions.length > 0) {
        auditProgramPermissions.forEach(perm => {
          console.log(`   ${perm.allowed ? '✅' : '❌'} ${perm.permission}`);
        });
      } else {
        console.log('   ❌ No audit program permissions assigned');
      }
    });
    
    // 5. Find the MR role and assign commit permission
    console.log('\n🔧 Assigning auditProgram:commit permission to MR role...');
    
    const mrRole = auroraTenant.roles.find(role => role.name === 'MR');
    if (!mrRole) {
      console.log('❌ MR role not found');
      return;
    }
    
    console.log(`✅ Found MR role: ${mrRole.name} (${mrRole.id})`);
    
    // Find the commit permission
    const commitPerm = await prisma.permission.findFirst({
      where: {
        module: 'auditProgram',
        action: 'commit'
      }
    });
    
    if (!commitPerm) {
      console.log('❌ auditProgram:commit permission not found');
      return;
    }
    
    // Check if MR role already has this permission
    const existingRolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: mrRole.id,
        permissionId: commitPerm.id
      }
    });
    
    if (existingRolePermission) {
      console.log('⏭️  MR role already has auditProgram:commit permission');
    } else {
      // Assign the permission to MR role
      try {
        await prisma.rolePermission.create({
          data: {
            roleId: mrRole.id,
            permissionId: commitPerm.id,
            allowed: true
          }
        });
        
        console.log('✅ Successfully assigned auditProgram:commit permission to MR role');
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
      
      const hasCommitPermission = userPermissions.has('auditProgram:commit');
      console.log(`   ${hasCommitPermission ? '✅' : '❌'} User has auditProgram:commit permission: ${hasCommitPermission}`);
      
      // Check all audit program permissions
      const auditProgramUserPermissions = Array.from(userPermissions).filter(p => p.startsWith('auditProgram:'));
      console.log('\n📋 Audit Program Permissions:');
      auditProgramUserPermissions.forEach(perm => {
        console.log(`   ✅ ${perm}`);
      });
      
      if (auditProgramUserPermissions.length === 0) {
        console.log('   ❌ No audit program permissions found');
      }
    } else {
      console.log('❌ MR user not found');
    }

    console.log('\n🎉 Audit program permission fix completed!');
    
  } catch (error) {
    console.error('❌ Error checking audit program permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkAuditProgramPermissions(); 