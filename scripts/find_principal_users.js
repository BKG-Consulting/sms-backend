const { prisma } = require('../prisma/client');

async function findUsersWithPrincipalRole() {
  try {
    console.log('=== SEARCHING FOR USERS WITH PRINCIPAL ROLE ===\n');
    
    // 1. First, find all PRINCIPAL roles across all tenants
    console.log('1. FINDING ALL PRINCIPAL ROLES:');
    
    const principalRoles = await prisma.role.findMany({
      where: { 
        name: { 
          in: ['PRINCIPAL', 'Principal', 'principal'] // Case variations
        }
      },
      include: {
        tenant: {
          select: { id: true, name: true, domain: true }
        }
      }
    });

    console.log(`✅ Found ${principalRoles.length} PRINCIPAL role(s):`);
    principalRoles.forEach((role, index) => {
      console.log(`\n${index + 1}. Role: ${role.name}`);
      console.log(`   ID: ${role.id}`);
      console.log(`   Tenant: ${role.tenant.name} (${role.tenant.domain})`);
      console.log(`   Description: ${role.description || 'No description'}`);
    });

    if (principalRoles.length === 0) {
      console.log('\n❌ No PRINCIPAL roles found in the system');
      console.log('This might mean:');
      console.log('1. The role is named differently (e.g., "ADMIN", "HEAD", etc.)');
      console.log('2. The role hasn\'t been created yet');
      console.log('3. Case sensitivity issue');
      
      // Let's check for similar roles
      console.log('\n🔍 Searching for similar roles...');
      const similarRoles = await prisma.role.findMany({
        where: {
          OR: [
            { name: { contains: 'PRIN', mode: 'insensitive' } },
            { name: { contains: 'HEAD', mode: 'insensitive' } },
            { name: { contains: 'ADMIN', mode: 'insensitive' } },
            { name: { contains: 'DIRECTOR', mode: 'insensitive' } }
          ]
        },
        include: {
          tenant: { select: { name: true, domain: true } }
        }
      });
      
      if (similarRoles.length > 0) {
        console.log(`Found ${similarRoles.length} similar role(s):`);
        similarRoles.forEach(role => {
          console.log(`  - ${role.name} (${role.tenant.name})`);
        });
      }
      
      return;
    }

    // 2. Find users assigned to PRINCIPAL roles (userRoles table)
    console.log('\n2. FINDING USERS WITH PRINCIPAL ROLES (Global/Tenant Roles):');
    
    const principalRoleIds = principalRoles.map(r => r.id);
    
    const usersWithPrincipalRoles = await prisma.userRole.findMany({
      where: {
        roleId: { in: principalRoleIds }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            verified: true,
            tenantId: true
          }
        },
        role: {
          include: {
            tenant: { select: { name: true, domain: true } }
          }
        }
      }
    });

    console.log(`✅ Found ${usersWithPrincipalRoles.length} user(s) with PRINCIPAL roles (global):`);
    usersWithPrincipalRoles.forEach((assignment, index) => {
      console.log(`\n${index + 1}. User: ${assignment.user.firstName} ${assignment.user.lastName}`);
      console.log(`   Email: ${assignment.user.email}`);
      console.log(`   Verified: ${assignment.user.verified}`);
      console.log(`   Role: ${assignment.role.name}`);
      console.log(`   Tenant: ${assignment.role.tenant.name} (${assignment.role.tenant.domain})`);
      console.log(`   User ID: ${assignment.user.id}`);
    });

    // 3. Find users assigned to PRINCIPAL roles in departments (userDepartmentRoles table)
    console.log('\n3. FINDING USERS WITH PRINCIPAL ROLES (Department Roles):');
    
    const usersWithPrincipalDeptRoles = await prisma.userDepartmentRole.findMany({
      where: {
        roleId: { in: principalRoleIds }
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            verified: true,
            tenantId: true
          }
        },
        role: {
          include: {
            tenant: { select: { name: true, domain: true } }
          }
        },
        department: {
          select: { id: true, name: true, code: true }
        }
      }
    });

    console.log(`✅ Found ${usersWithPrincipalDeptRoles.length} user(s) with PRINCIPAL department roles:`);
    usersWithPrincipalDeptRoles.forEach((assignment, index) => {
      console.log(`\n${index + 1}. User: ${assignment.user.firstName} ${assignment.user.lastName}`);
      console.log(`   Email: ${assignment.user.email}`);
      console.log(`   Verified: ${assignment.user.verified}`);
      console.log(`   Role: ${assignment.role.name}`);
      console.log(`   Department: ${assignment.department?.name || 'No Department'}`);
      console.log(`   Tenant: ${assignment.role.tenant.name} (${assignment.role.tenant.domain})`);
      console.log(`   User ID: ${assignment.user.id}`);
    });

    // 4. Specific check for runyenjestvt
    console.log('\n4. SPECIFIC CHECK FOR RUNYENJESTVT:');
    
    const runyenjestvt = await prisma.tenant.findFirst({
      where: {
        OR: [
          { domain: { contains: 'runyenjestvt', mode: 'insensitive' } },
          { name: { contains: 'runyenjestvt', mode: 'insensitive' } },
          { domain: { contains: 'runyenjes', mode: 'insensitive' } },
          { name: { contains: 'runyenjes', mode: 'insensitive' } }
        ]
      }
    });

    if (runyenjestvt) {
      console.log(`✅ Found tenant: ${runyenjestvt.name} (${runyenjestvt.domain})`);
      
      // Check for PRINCIPAL role in this specific tenant
      const runyenjesPrincipalRole = principalRoles.find(r => r.tenantId === runyenjestvt.id);
      
      if (runyenjesPrincipalRole) {
        console.log(`✅ PRINCIPAL role exists for ${runyenjestvt.name}`);
        
        // Find users with this role
        const runyenjesUsers = [
          ...usersWithPrincipalRoles.filter(u => u.user.tenantId === runyenjestvt.id),
          ...usersWithPrincipalDeptRoles.filter(u => u.user.tenantId === runyenjestvt.id)
        ];
        
        if (runyenjesUsers.length > 0) {
          console.log(`✅ Found ${runyenjesUsers.length} user(s) with PRINCIPAL role in ${runyenjestvt.name}:`);
          runyenjesUsers.forEach((assignment, index) => {
            console.log(`\n  ${index + 1}. ${assignment.user.firstName} ${assignment.user.lastName}`);
            console.log(`     Email: ${assignment.user.email}`);
            console.log(`     Role Type: ${assignment.department ? 'Department Role' : 'Global Role'}`);
            if (assignment.department) {
              console.log(`     Department: ${assignment.department.name}`);
            }
          });
        } else {
          console.log(`❌ No users found with PRINCIPAL role in ${runyenjestvt.name}`);
        }
      } else {
        console.log(`❌ No PRINCIPAL role found for ${runyenjestvt.name}`);
        
        // Check what roles exist for this tenant
        const runyenjesRoles = await prisma.role.findMany({
          where: { tenantId: runyenjestvt.id },
          select: { name: true, description: true }
        });
        
        console.log(`Available roles for ${runyenjestvt.name}:`);
        runyenjesRoles.forEach(role => {
          console.log(`  - ${role.name}: ${role.description || 'No description'}`);
        });
      }
    } else {
      console.log('❌ Tenant "runyenjestvt" not found');
      console.log('Searching for similar tenant names...');
      
      const similarTenants = await prisma.tenant.findMany({
        where: {
          OR: [
            { domain: { contains: 'runyenjes', mode: 'insensitive' } },
            { name: { contains: 'runyenjes', mode: 'insensitive' } },
            { domain: { contains: 'tvt', mode: 'insensitive' } },
            { name: { contains: 'tvt', mode: 'insensitive' } }
          ]
        },
        select: { name: true, domain: true }
      });
      
      if (similarTenants.length > 0) {
        console.log('Found similar tenants:');
        similarTenants.forEach(tenant => {
          console.log(`  - ${tenant.name} (${tenant.domain})`);
        });
      }
    }

    // 5. Summary
    console.log('\n5. SUMMARY:');
    const totalPrincipalUsers = usersWithPrincipalRoles.length + usersWithPrincipalDeptRoles.length;
    console.log(`Total users with PRINCIPAL role across all tenants: ${totalPrincipalUsers}`);
    
    if (totalPrincipalUsers === 0) {
      console.log('\n🚨 No users found with PRINCIPAL role!');
      console.log('This might indicate:');
      console.log('1. PRINCIPAL roles exist but no users are assigned');
      console.log('2. The role is named differently');
      console.log('3. Users have not been created yet');
    }

  } catch (error) {
    console.error('Error searching for PRINCIPAL users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findUsersWithPrincipalRole();
