const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findRunyenjesPrincipal() {
  console.log('🔍 FINDING PRINCIPAL FOR RUNYENJES TECHNICAL AND VOCATIONAL COLLEGE\n');

  try {
    // Find Runyenjes tenant
    const runyenjesTenant = await prisma.tenant.findFirst({
      where: {
        domain: 'runyenjes'
      },
      include: {
        users: {
          include: {
            userRoles: {
              include: {
                role: true
              }
            },
            userDepartmentRoles: {
              include: {
                department: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!runyenjesTenant) {
      console.log('❌ Runyenjes Technical and Vocational College not found!');
      return;
    }

    console.log(`📍 INSTITUTION: ${runyenjesTenant.name}`);
    console.log(`   Domain: ${runyenjesTenant.domain}`);
    console.log(`   Email: ${runyenjesTenant.email}`);
    console.log(`   Type: ${runyenjesTenant.type}`);
    console.log(`   Status: ${runyenjesTenant.status}\n`);

    // Find users with PRINCIPAL role
    const principalUsers = runyenjesTenant.users.filter(user => {
      // Check userRoles for PRINCIPAL
      const hasPrincipalUserRole = user.userRoles.some(ur => 
        ur.role.name === 'PRINCIPAL'
      );
      
      // Check userDepartmentRoles for PRINCIPAL
      const hasPrincipalDeptRole = user.userDepartmentRoles.some(udr => 
        udr.role.name === 'PRINCIPAL'
      );
      
      return hasPrincipalUserRole || hasPrincipalDeptRole;
    });

    if (principalUsers.length === 0) {
      console.log('❌ No PRINCIPAL found for Runyenjes Technical and Vocational College!');
      
      // Show all users and their roles for debugging
      console.log('\n👥 ALL USERS AND THEIR ROLES:');
      runyenjesTenant.users.forEach((user, index) => {
        console.log(`\n   User ${index + 1}: ${user.firstName} ${user.lastName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Verified: ${user.verified ? '✅' : '❌'}`);
        console.log(`   Created: ${user.createdAt}`);
        
        if (user.userRoles.length > 0) {
          console.log(`   🔑 User Roles:`);
          user.userRoles.forEach(ur => {
            console.log(`     • ${ur.role.name} (${ur.role.description || 'No description'})`);
          });
        }
        
        if (user.userDepartmentRoles.length > 0) {
          console.log(`   🏢 Department Roles:`);
          user.userDepartmentRoles.forEach(udr => {
            console.log(`     • ${udr.role.name} in ${udr.department?.name || 'Unknown Department'}`);
          });
        }
      });
    } else {
      console.log(`✅ Found ${principalUsers.length} PRINCIPAL user(s):\n`);
      
      principalUsers.forEach((user, index) => {
        console.log(`   PRINCIPAL ${index + 1}: ${user.firstName} ${user.lastName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Verified: ${user.verified ? '✅' : '❌'}`);
        console.log(`   Created: ${user.createdAt}`);
        
        // Show where PRINCIPAL role is assigned
        const principalUserRoles = user.userRoles.filter(ur => ur.role.name === 'PRINCIPAL');
        const principalDeptRoles = user.userDepartmentRoles.filter(udr => udr.role.name === 'PRINCIPAL');
        
        if (principalUserRoles.length > 0) {
          console.log(`   🔑 PRINCIPAL User Role: ✅`);
        }
        
        if (principalDeptRoles.length > 0) {
          console.log(`   🏢 PRINCIPAL Department Role(s):`);
          principalDeptRoles.forEach(udr => {
            console.log(`     • ${udr.department?.name || 'Unknown Department'}`);
          });
        }
        
        // Show all other roles
        const otherUserRoles = user.userRoles.filter(ur => ur.role.name !== 'PRINCIPAL');
        const otherDeptRoles = user.userDepartmentRoles.filter(udr => udr.role.name !== 'PRINCIPAL');
        
        if (otherUserRoles.length > 0) {
          console.log(`   🔑 Other User Roles:`);
          otherUserRoles.forEach(ur => {
            console.log(`     • ${ur.role.name}`);
          });
        }
        
        if (otherDeptRoles.length > 0) {
          console.log(`   🏢 Other Department Roles:`);
          otherDeptRoles.forEach(udr => {
            console.log(`     • ${udr.role.name} in ${udr.department?.name || 'Unknown Department'}`);
          });
        }
        
        console.log(''); // Empty line for separation
      });
    }

    // Also check if there are any roles with "PRINCIPAL" in the name
    const allRoles = await prisma.role.findMany({
      where: {
        tenantId: runyenjesTenant.id,
        name: {
          contains: 'PRINCIPAL',
          mode: 'insensitive'
        }
      }
    });

    if (allRoles.length > 0) {
      console.log('🔍 ROLES CONTAINING "PRINCIPAL":');
      allRoles.forEach(role => {
        console.log(`   • ${role.name} (${role.description || 'No description'})`);
      });
    }

  } catch (error) {
    console.error('❌ Error finding Runyenjes principal:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
findRunyenjesPrincipal(); 