const { prisma } = require('../prisma/client');

/**
 * ENTERPRISE MULTI-TENANT RBAC SYSTEM CODE REVIEW
 * 
 * This script analyzes the current implementation and identifies
 * areas for improvement in our multi-tenant role-based access control system.
 */

async function comprehensiveRBACReview() {
  console.log('=== ENTERPRISE RBAC SYSTEM CODE REVIEW ===\n');

  try {
    // 1. ANALYZE CURRENT TENANT ARCHITECTURE
    console.log('1️⃣ TENANT ARCHITECTURE ANALYSIS:');
    
    const tenants = await prisma.tenant.findMany({
      include: {
        _count: {
          select: {
            users: true,
            roles: true,
            departments: true,
            campuses: true
          }
        }
      }
    });

    console.log(`   Total Tenants: ${tenants.length}`);
    tenants.forEach(tenant => {
      console.log(`   📊 ${tenant.name}:`);
      console.log(`      Users: ${tenant._count.users}`);
      console.log(`      Roles: ${tenant._count.roles}`);
      console.log(`      Departments: ${tenant._count.departments}`);
      console.log(`      Campuses: ${tenant._count.campuses}`);
    });

    // 2. ANALYZE ROLE DISTRIBUTION AND HIERARCHY
    console.log('\n2️⃣ ROLE HIERARCHY ANALYSIS:');
    
    const allRoles = await prisma.role.findMany({
      include: {
        tenant: { select: { name: true } },
        userRoles: { include: { user: { select: { email: true } } } },
        userDepartmentRoles: { include: { user: { select: { email: true } } } },
        _count: {
          select: {
            userRoles: true,
            userDepartmentRoles: true,
            rolePermissions: true
          }
        }
      }
    });

    // Group roles by hierarchy level
    const roleHierarchy = {
      'SUPER_ADMIN': [],
      'SYSTEM_ADMIN': [],
      'PRINCIPAL': [],
      'MR': [],
      'AUDITOR': [],
      'HOD': [],
      'HOD AUDITOR': [],
      'STAFF': [],
      'OTHER': []
    };

    allRoles.forEach(role => {
      const category = roleHierarchy[role.name] ? role.name : 'OTHER';
      roleHierarchy[category].push({
        id: role.id,
        tenant: role.tenant.name,
        userCount: role._count.userRoles + role._count.userDepartmentRoles,
        permissionCount: role._count.rolePermissions
      });
    });

    Object.entries(roleHierarchy).forEach(([roleName, roles]) => {
      if (roles.length > 0) {
        console.log(`   🔐 ${roleName}: ${roles.length} instance(s)`);
        roles.forEach(role => {
          console.log(`      - ${role.tenant}: ${role.userCount} users, ${role.permissionCount} permissions`);
        });
      }
    });

    // 3. ANALYZE PERMISSION COVERAGE
    console.log('\n3️⃣ PERMISSION COVERAGE ANALYSIS:');
    
    const permissions = await prisma.permission.findMany({
      include: {
        _count: {
          select: {
            rolePermissions: true
          }
        }
      }
    });

    console.log(`   Total Permissions: ${permissions.length}`);
    
    const permissionCategories = {};
    permissions.forEach(perm => {
      const category = perm.resource || 'UNCATEGORIZED';
      if (!permissionCategories[category]) {
        permissionCategories[category] = [];
      }
      permissionCategories[category].push({
        name: perm.name,
        action: perm.action,
        roleCount: perm._count.rolePermissions
      });
    });

    Object.entries(permissionCategories).forEach(([category, perms]) => {
      console.log(`   📋 ${category}: ${perms.length} permission(s)`);
      perms.forEach(perm => {
        console.log(`      - ${perm.action}:${perm.name} (${perm.roleCount} roles)`);
      });
    });

    // 4. IDENTIFY CROSS-TENANT ISSUES
    console.log('\n4️⃣ CROSS-TENANT CONTAMINATION CHECK:');
    
    const crossTenantIssues = [];
    
    // Check user roles
    const userRoleIssues = await prisma.userRole.findMany({
      include: {
        user: { select: { tenantId: true, email: true } },
        role: { select: { tenantId: true, name: true } }
      }
    });

    userRoleIssues.forEach(ur => {
      if (ur.user.tenantId !== ur.role.tenantId) {
        crossTenantIssues.push({
          type: 'USER_ROLE',
          userEmail: ur.user.email,
          userTenant: ur.user.tenantId,
          roleName: ur.role.name,
          roleTenant: ur.role.tenantId
        });
      }
    });

    // Check department roles
    const deptRoleIssues = await prisma.userDepartmentRole.findMany({
      include: {
        user: { select: { tenantId: true, email: true } },
        role: { select: { tenantId: true, name: true } },
        department: { select: { tenantId: true, name: true } }
      }
    });

    deptRoleIssues.forEach(udr => {
      if (udr.user.tenantId !== udr.role.tenantId) {
        crossTenantIssues.push({
          type: 'DEPT_ROLE',
          userEmail: udr.user.email,
          userTenant: udr.user.tenantId,
          roleName: udr.role.name,
          roleTenant: udr.role.tenantId,
          department: udr.department?.name
        });
      }
      if (udr.department && udr.user.tenantId !== udr.department.tenantId) {
        crossTenantIssues.push({
          type: 'DEPT_TENANT',
          userEmail: udr.user.email,
          userTenant: udr.user.tenantId,
          departmentName: udr.department.name,
          departmentTenant: udr.department.tenantId
        });
      }
    });

    if (crossTenantIssues.length === 0) {
      console.log('   ✅ No cross-tenant contamination detected');
    } else {
      console.log(`   🚨 Found ${crossTenantIssues.length} cross-tenant issue(s):`);
      crossTenantIssues.forEach(issue => {
        console.log(`      - ${issue.type}: ${issue.userEmail}`);
      });
    }

    // 5. ANALYZE SUPER ADMIN IMPLEMENTATION
    console.log('\n5️⃣ SUPER ADMIN IMPLEMENTATION ANALYSIS:');
    
    const superAdmins = await prisma.userRole.findMany({
      where: {
        role: { name: 'SUPER_ADMIN' }
      },
      include: {
        user: { select: { email: true, tenantId: true } },
        role: { select: { name: true, tenantId: true } }
      }
    });

    if (superAdmins.length === 0) {
      console.log('   ⚠️  No SUPER_ADMIN users found - this is a critical gap!');
    } else {
      console.log(`   Found ${superAdmins.length} SUPER_ADMIN user(s):`);
      superAdmins.forEach(sa => {
        console.log(`      - ${sa.user.email} (tenant: ${sa.user.tenantId})`);
      });
    }

    // 6. SYSTEM INTEGRITY SCORE
    console.log('\n6️⃣ SYSTEM INTEGRITY SCORE:');
    
    const score = {
      tenantIsolation: crossTenantIssues.length === 0 ? 100 : Math.max(0, 100 - (crossTenantIssues.length * 10)),
      roleHierarchy: Object.keys(roleHierarchy).filter(k => roleHierarchy[k].length > 0).length * 10,
      permissionCoverage: Math.min(100, permissions.length * 2),
      superAdminSetup: superAdmins.length > 0 ? 100 : 0
    };

    const overallScore = Math.round((score.tenantIsolation + score.roleHierarchy + score.permissionCoverage + score.superAdminSetup) / 4);

    console.log(`   🎯 Tenant Isolation: ${score.tenantIsolation}%`);
    console.log(`   🔐 Role Hierarchy: ${score.roleHierarchy}%`);
    console.log(`   📋 Permission Coverage: ${score.permissionCoverage}%`);
    console.log(`   👑 Super Admin Setup: ${score.superAdminSetup}%`);
    console.log(`   📊 OVERALL SCORE: ${overallScore}%`);

    if (overallScore >= 90) {
      console.log('   ✅ ENTERPRISE READY');
    } else if (overallScore >= 70) {
      console.log('   ⚠️  NEEDS IMPROVEMENTS');
    } else {
      console.log('   🚨 CRITICAL ISSUES DETECTED');
    }

  } catch (error) {
    console.error('❌ Review failed:', error);
    throw error;
  }
}

comprehensiveRBACReview()
  .then(() => {
    console.log('\n=== RBAC SYSTEM REVIEW COMPLETE ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Review failed:', error);
    process.exit(1);
  });
