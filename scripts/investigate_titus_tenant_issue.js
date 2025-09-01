const { prisma } = require('../prisma/client');

async function investigateTitusUserIssue() {
  try {
    console.log('=== INVESTIGATING TITUS USER TENANT ASSIGNMENT ISSUE ===\n');
    
    const titusUserId = '4db13ba9-7643-41af-a74c-e201927c21a3';
    const titusEmail = 'titus@rtvc.ac.ke';
    
    // 1. Get full details of Titus user
    console.log('1. TITUS USER FULL DETAILS:');
    
    const titusUser = await prisma.user.findUnique({
      where: { id: titusUserId },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                tenant: true
              }
            }
          }
        },
        userDepartmentRoles: {
          include: {
            role: {
              include: {
                tenant: true
              }
            },
            department: {
              include: {
                tenant: true
              }
            }
          }
        }
      }
    });

    if (!titusUser) {
      console.log('❌ User not found!');
      return;
    }

    console.log('User Information:');
    console.log(`  Name: ${titusUser.firstName} ${titusUser.lastName}`);
    console.log(`  Email: ${titusUser.email}`);
    console.log(`  User ID: ${titusUser.id}`);
    console.log(`  Verified: ${titusUser.verified}`);
    console.log(`  Created: ${titusUser.createdAt}`);
    console.log(`  User Tenant ID: ${titusUser.tenantId}`);
    console.log(`  User Tenant: ${titusUser.tenant.name} (${titusUser.tenant.domain})`);

    // 2. Check if there are multiple users with same email
    console.log('\n2. CHECKING FOR DUPLICATE USERS WITH SAME EMAIL:');
    
    const usersWithSameEmail = await prisma.user.findMany({
      where: { email: titusEmail },
      include: {
        tenant: { select: { name: true, domain: true } }
      }
    });

    console.log(`Found ${usersWithSameEmail.length} user(s) with email ${titusEmail}:`);
    usersWithSameEmail.forEach((user, index) => {
      console.log(`\n  ${index + 1}. User ID: ${user.id}`);
      console.log(`     Name: ${user.firstName} ${user.lastName}`);
      console.log(`     Tenant: ${user.tenant.name} (${user.tenant.domain})`);
      console.log(`     Created: ${user.createdAt}`);
      console.log(`     Verified: ${user.verified}`);
    });

    // 3. Check RTVC tenant details
    console.log('\n3. RTVC TENANT DETAILS:');
    
    const rtvcTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { domain: 'rtvc' },
          { domain: { contains: 'rtvc' } },
          { name: { contains: 'Runyenjes', mode: 'insensitive' } }
        ]
      }
    });

    if (rtvcTenant) {
      console.log(`✅ RTVC Tenant found:`);
      console.log(`   Name: ${rtvcTenant.name}`);
      console.log(`   Domain: ${rtvcTenant.domain}`);
      console.log(`   ID: ${rtvcTenant.id}`);
      console.log(`   Created: ${rtvcTenant.createdAt}`);
    } else {
      console.log('❌ RTVC tenant not found!');
    }

    // 4. Check Titus's role assignments
    console.log('\n4. TITUS ROLE ASSIGNMENTS:');
    
    console.log(`User Roles (${titusUser.userRoles.length}):`);
    titusUser.userRoles.forEach((userRole, index) => {
      console.log(`\n  ${index + 1}. Role: ${userRole.role.name}`);
      console.log(`     Role ID: ${userRole.role.id}`);
      console.log(`     Role Tenant: ${userRole.role.tenant.name} (${userRole.role.tenant.domain})`);
      console.log(`     Role Tenant ID: ${userRole.role.tenantId}`);
      console.log(`     🚨 MISMATCH?: User tenant (${titusUser.tenantId}) vs Role tenant (${userRole.role.tenantId})`);
    });

    console.log(`\nDepartment Roles (${titusUser.userDepartmentRoles.length}):`);
    titusUser.userDepartmentRoles.forEach((deptRole, index) => {
      console.log(`\n  ${index + 1}. Role: ${deptRole.role.name}`);
      console.log(`     Role Tenant: ${deptRole.role.tenant.name}`);
      console.log(`     Department: ${deptRole.department?.name || 'No Department'}`);
      if (deptRole.department) {
        console.log(`     Dept Tenant: ${deptRole.department.tenant.name}`);
      }
    });

    // 5. Check Default Tenant details
    console.log('\n5. DEFAULT TENANT DETAILS:');
    
    const defaultTenant = await prisma.tenant.findFirst({
      where: { domain: 'default.local' }
    });

    if (defaultTenant) {
      console.log(`Default Tenant:`);
      console.log(`   Name: ${defaultTenant.name}`);
      console.log(`   Domain: ${defaultTenant.domain}`);
      console.log(`   ID: ${defaultTenant.id}`);
    }

    // 6. Analysis and recommendations
    console.log('\n6. ISSUE ANALYSIS:');
    
    const correctTenantId = rtvcTenant?.id;
    const currentTenantId = titusUser.tenantId;
    
    if (correctTenantId && currentTenantId !== correctTenantId) {
      console.log('🚨 CONFIRMED ISSUE: User is assigned to wrong tenant!');
      console.log(`   Current Tenant: ${titusUser.tenant.name} (${currentTenantId})`);
      console.log(`   Should be Tenant: ${rtvcTenant.name} (${correctTenantId})`);
      
      // Check if roles also need to be moved
      const crossTenantRoles = titusUser.userRoles.filter(ur => ur.role.tenantId !== correctTenantId);
      if (crossTenantRoles.length > 0) {
        console.log(`   🚨 ${crossTenantRoles.length} role(s) also from wrong tenant!`);
      }
      
      console.log('\n📋 RECOMMENDED FIXES:');
      console.log('1. Move Titus user to RTVC tenant');
      console.log('2. Check if PRINCIPAL role exists for RTVC tenant');
      console.log('3. If not, create PRINCIPAL role for RTVC');
      console.log('4. Reassign Titus to correct PRINCIPAL role');
      console.log('5. Clean up any orphaned role assignments');
      
    } else if (!correctTenantId) {
      console.log('❌ Cannot determine correct tenant - RTVC tenant not found');
    } else {
      console.log('✅ User is in correct tenant');
    }

    // 7. Check for other users in Default Tenant that might belong elsewhere
    console.log('\n7. OTHER USERS IN DEFAULT TENANT WITH SUSPICIOUS EMAILS:');
    
    const defaultTenantUsers = await prisma.user.findMany({
      where: { 
        tenantId: defaultTenant?.id,
        email: { 
          not: { 
            contains: 'default' 
          } 
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true
      }
    });

    console.log(`Found ${defaultTenantUsers.length} users in Default Tenant with non-default emails:`);
    defaultTenantUsers.forEach(user => {
      console.log(`  - ${user.firstName} ${user.lastName} (${user.email})`);
      
      // Try to guess correct tenant from email domain
      const emailDomain = user.email.split('@')[1];
      console.log(`    Email domain: ${emailDomain} - might belong to tenant with similar domain`);
    });

  } catch (error) {
    console.error('Error during investigation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateTitusUserIssue();
