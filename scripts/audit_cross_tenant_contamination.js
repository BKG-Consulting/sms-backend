const { prisma } = require('../prisma/client');

async function auditCrossTenantContamination() {
  console.log('=== AUDITING CROSS-TENANT CONTAMINATION ===\n');

  try {
    // 1. Find all users with roles from different tenants than their own
    console.log('1️⃣ CHECKING USER ROLES FOR CROSS-TENANT CONTAMINATION:');
    
    const usersWithCrossTenantRoles = await prisma.user.findMany({
      include: {
        tenant: true,
        userRoles: { 
          include: { 
            role: { 
              include: { tenant: true } 
            } 
          } 
        },
        userDepartmentRoles: { 
          include: { 
            role: { 
              include: { tenant: true } 
            },
            department: { 
              include: { tenant: true } 
            } 
          } 
        }
      }
    });

    const contaminatedUsers = [];
    
    for (const user of usersWithCrossTenantRoles) {
      const issues = [];
      
      // Check user roles
      for (const userRole of user.userRoles) {
        if (userRole.role.tenantId !== user.tenantId) {
          issues.push({
            type: 'userRole',
            roleName: userRole.role.name,
            roleId: userRole.role.id,
            roleTenant: userRole.role.tenant.name,
            roleTenantId: userRole.role.tenantId,
            userTenant: user.tenant.name,
            userTenantId: user.tenantId
          });
        }
      }
      
      // Check department roles
      for (const deptRole of user.userDepartmentRoles) {
        if (deptRole.role.tenantId !== user.tenantId) {
          issues.push({
            type: 'departmentRole',
            roleName: deptRole.role.name,
            roleId: deptRole.role.id,
            roleTenant: deptRole.role.tenant.name,
            roleTenantId: deptRole.role.tenantId,
            departmentTenant: deptRole.department?.tenant.name,
            departmentTenantId: deptRole.department?.tenantId,
            userTenant: user.tenant.name,
            userTenantId: user.tenantId
          });
        }
        
        // Also check if department is from different tenant
        if (deptRole.department && deptRole.department.tenantId !== user.tenantId) {
          issues.push({
            type: 'departmentTenant',
            departmentName: deptRole.department.name,
            departmentId: deptRole.department.id,
            departmentTenant: deptRole.department.tenant.name,
            departmentTenantId: deptRole.department.tenantId,
            userTenant: user.tenant.name,
            userTenantId: user.tenantId
          });
        }
      }
      
      if (issues.length > 0) {
        contaminatedUsers.push({
          user: {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            tenant: user.tenant.name,
            tenantId: user.tenantId
          },
          issues
        });
      }
    }
    
    if (contaminatedUsers.length === 0) {
      console.log('   ✅ No cross-tenant contamination found in user roles!');
    } else {
      console.log(`   🚨 Found ${contaminatedUsers.length} users with cross-tenant contamination:\n`);
      
      for (const { user, issues } of contaminatedUsers) {
        console.log(`   👤 ${user.name} (${user.email})`);
        console.log(`      User Tenant: ${user.tenant} (${user.tenantId})`);
        console.log(`      Issues: ${issues.length}`);
        
        for (const issue of issues) {
          if (issue.type === 'userRole') {
            console.log(`      ❌ User Role: "${issue.roleName}" from "${issue.roleTenant}" (should be from "${user.tenant}")`);
          } else if (issue.type === 'departmentRole') {
            console.log(`      ❌ Dept Role: "${issue.roleName}" from "${issue.roleTenant}" (should be from "${user.tenant}")`);
          } else if (issue.type === 'departmentTenant') {
            console.log(`      ❌ Department: "${issue.departmentName}" from "${issue.departmentTenant}" (should be from "${user.tenant}")`);
          }
        }
        console.log('');
      }
    }

    // 2. Check for duplicate role names across tenants (potential confusion source)
    console.log('\n2️⃣ CHECKING FOR DUPLICATE ROLE NAMES ACROSS TENANTS:');
    
    const allRoles = await prisma.role.findMany({
      include: { tenant: true },
      orderBy: [{ name: 'asc' }, { tenantId: 'asc' }]
    });
    
    const roleNameGroups = {};
    allRoles.forEach(role => {
      if (!roleNameGroups[role.name]) {
        roleNameGroups[role.name] = [];
      }
      roleNameGroups[role.name].push(role);
    });
    
    const duplicateRoleNames = Object.entries(roleNameGroups).filter(([name, roles]) => roles.length > 1);
    
    if (duplicateRoleNames.length === 0) {
      console.log('   ✅ No duplicate role names found across tenants');
    } else {
      console.log(`   ⚠️  Found ${duplicateRoleNames.length} role names that exist in multiple tenants:\n`);
      
      for (const [roleName, roles] of duplicateRoleNames) {
        console.log(`   📝 "${roleName}" (${roles.length} instances):`);
        for (const role of roles) {
          console.log(`      - ${role.tenant?.name || 'Unknown Tenant'} (${role.tenantId}) - ID: ${role.id}`);
        }
        console.log('');
      }
    }

    // 3. Check for HOD assignments that reference users from different tenants
    console.log('\n3️⃣ CHECKING HOD ASSIGNMENTS FOR CROSS-TENANT ISSUES:');
    
    const departmentsWithHod = await prisma.department.findMany({
      where: { hodId: { not: null } },
      include: {
        tenant: true,
        hod: { include: { tenant: true } }
      }
    });
    
    const hodIssues = [];
    for (const dept of departmentsWithHod) {
      if (dept.hod && dept.hod.tenantId !== dept.tenantId) {
        hodIssues.push({
          department: dept.name,
          departmentTenant: dept.tenant.name,
          departmentTenantId: dept.tenantId,
          hodName: `${dept.hod.firstName} ${dept.hod.lastName}`,
          hodEmail: dept.hod.email,
          hodTenant: dept.hod.tenant.name,
          hodTenantId: dept.hod.tenantId
        });
      }
    }
    
    if (hodIssues.length === 0) {
      console.log('   ✅ All HOD assignments are within correct tenants');
    } else {
      console.log(`   🚨 Found ${hodIssues.length} HOD assignments with cross-tenant issues:\n`);
      
      for (const issue of hodIssues) {
        console.log(`   🏢 Department: "${issue.department}" (${issue.departmentTenant})`);
        console.log(`   👤 HOD: ${issue.hodName} (${issue.hodEmail})`);
        console.log(`   ❌ HOD is from different tenant: "${issue.hodTenant}"`);
        console.log('');
      }
    }

    // 4. Summary and recommendations
    console.log('\n4️⃣ SUMMARY AND RECOMMENDATIONS:');
    
    const totalIssues = contaminatedUsers.length + hodIssues.length;
    
    if (totalIssues === 0) {
      console.log('   ✅ No cross-tenant contamination issues found!');
      console.log('   ✅ Data integrity is maintained across all tenants');
    } else {
      console.log(`   🚨 Found ${totalIssues} cross-tenant contamination issues`);
      console.log('   📋 RECOMMENDED ACTIONS:');
      
      if (contaminatedUsers.length > 0) {
        console.log(`   1. Fix ${contaminatedUsers.length} users with cross-tenant role assignments`);
        console.log('   2. Investigate how these roles were assigned (likely via insecure endpoints)');
      }
      
      if (hodIssues.length > 0) {
        console.log(`   3. Fix ${hodIssues.length} HOD assignments pointing to wrong tenant users`);
      }
      
      if (duplicateRoleNames.length > 0) {
        console.log(`   4. Consider role naming conventions to avoid confusion with ${duplicateRoleNames.length} duplicate names`);
      }
      
      console.log('   5. Ensure all role selection UIs use tenant-scoped endpoints only');
      console.log('   6. Add automated tests to prevent cross-tenant contamination');
    }

  } catch (error) {
    console.error('❌ Audit failed:', error);
    throw error;
  }
}

auditCrossTenantContamination()
  .then(() => {
    console.log('\n=== CROSS-TENANT AUDIT COMPLETE ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  });
