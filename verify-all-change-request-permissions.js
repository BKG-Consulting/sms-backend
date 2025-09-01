const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyAllChangeRequestPermissions() {
  try {
    console.log('🔍 Verifying All Change Request Permissions...');
    
    // 1. Check all documentChangeRequest permissions in the database
    console.log('\n📋 Checking all documentChangeRequest permissions in database...');
    
    const allPermissions = await prisma.permission.findMany({
      where: {
        module: 'documentChangeRequest'
      },
      orderBy: { action: 'asc' }
    });
    
    console.log('Found documentChangeRequest permissions:');
    allPermissions.forEach(perm => {
      console.log(`   ✅ ${perm.module}:${perm.action} - ${perm.description}`);
    });
    
    // 2. Get Aurora tenant and all its roles
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
    
    // 3. Check role permissions for each role
    console.log('\n🔧 Checking role permissions...');
    
    auroraTenant.roles.forEach(role => {
      console.log(`\n📋 Role: ${role.name}`);
      
      const changeRequestPermissions = role.rolePermissions
        .filter(rp => rp.permission.module === 'documentChangeRequest')
        .map(rp => ({
          permission: `${rp.permission.module}:${rp.permission.action}`,
          allowed: rp.allowed
        }));
      
      if (changeRequestPermissions.length > 0) {
        changeRequestPermissions.forEach(perm => {
          console.log(`   ${perm.allowed ? '✅' : '❌'} ${perm.permission}`);
        });
      } else {
        console.log('   ❌ No change request permissions assigned');
      }
    });
    
    // 4. Check specific MR user permissions
    console.log('\n👤 Checking MR user permissions...');
    
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
      const changeRequestPermissions = [];
      
      mrUser.userRoles.forEach(userRole => {
        userRole.role.rolePermissions.forEach(rp => {
          if (rp.allowed) {
            const permissionString = `${rp.permission.module}:${rp.permission.action}`;
            userPermissions.add(permissionString);
            
            if (rp.permission.module === 'documentChangeRequest') {
              changeRequestPermissions.push(permissionString);
            }
          }
        });
      });
      
      console.log('\n📋 MR User Change Request Permissions:');
      if (changeRequestPermissions.length > 0) {
        changeRequestPermissions.forEach(perm => {
          console.log(`   ✅ ${perm}`);
        });
      } else {
        console.log('   ❌ No change request permissions found');
      }
      
      // Check specific permissions needed for UI
      const requiredPermissions = [
        'documentChangeRequest:approve',
        'documentChangeRequest:reject', 
        'documentChangeRequest:apply'
      ];
      
      console.log('\n🎯 Required Permissions Check:');
      requiredPermissions.forEach(perm => {
        const hasPermission = userPermissions.has(perm);
        console.log(`   ${hasPermission ? '✅' : '❌'} ${perm}: ${hasPermission ? 'GRANTED' : 'MISSING'}`);
      });
      
      // Check if user has any change request permissions at all
      const hasAnyChangeRequestPermission = changeRequestPermissions.length > 0;
      console.log(`\n📊 Summary: ${hasAnyChangeRequestPermission ? '✅' : '❌'} User has change request permissions: ${hasAnyChangeRequestPermission}`);
      
    } else {
      console.log('❌ MR user not found');
    }
    
    // 5. Check if there are any permission mismatches
    console.log('\n🔍 Checking for permission mismatches...');
    
    const expectedPermissions = [
      'documentChangeRequest:read',
      'documentChangeRequest:approve',
      'documentChangeRequest:reject',
      'documentChangeRequest:apply'
    ];
    
    const missingPermissions = expectedPermissions.filter(expected => 
      !allPermissions.some(perm => `${perm.module}:${perm.action}` === expected)
    );
    
    if (missingPermissions.length > 0) {
      console.log('❌ Missing permissions in database:');
      missingPermissions.forEach(perm => {
        console.log(`   ❌ ${perm}`);
      });
    } else {
      console.log('✅ All expected permissions exist in database');
    }
    
    console.log('\n🎉 Permission verification completed!');
    
  } catch (error) {
    console.error('❌ Error verifying permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyAllChangeRequestPermissions(); 