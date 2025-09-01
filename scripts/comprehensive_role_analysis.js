const { prisma } = require('../prisma/client');

async function comprehensiveRoleArchitectureAnalysis() {
  try {
    console.log('=== COMPREHENSIVE ROLE ARCHITECTURE ANALYSIS ===\n');
    
    const tenantId = '40bbcd5e-2eb9-4c18-ad83-55a96db87003'; // Wilson's tenant
    
    // 1. Get all roles for Wilson's tenant
    const tenantRoles = await prisma.role.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: {
            userRoles: true,
            userDepartmentRoles: true
          }
        }
      }
    });

    console.log(`✅ Found ${tenantRoles.length} roles for Wilson's tenant:`);
    tenantRoles.forEach((role, index) => {
      console.log(`  ${index + 1}. ${role.name} (${role.id})`);
      console.log(`     Created: ${role.createdAt}`);
      console.log(`     Description: ${role.description || 'No description'}`);
      console.log(`     UserRoles: ${role._count.userRoles}, DeptRoles: ${role._count.userDepartmentRoles}`);
    });

    // 2. Get roles from other tenants that might be incorrectly assigned
    const otherTenantRoles = await prisma.role.findMany({
      where: { 
        tenantId: { not: tenantId },
        name: { in: ['HOD', 'STAFF', 'AUDITOR', 'HOD AUDITOR'] }
      },
      include: {
        tenant: { select: { name: true, domain: true } },
        _count: {
          select: {
            userRoles: true,
            userDepartmentRoles: true
          }
        }
      }
    });

    console.log(`\n⚠️  Found ${otherTenantRoles.length} similar roles from OTHER tenants:`);
    otherTenantRoles.forEach((role, index) => {
      console.log(`  ${index + 1}. ${role.name} (${role.id}) from ${role.tenant.name}`);
      console.log(`     Created: ${role.createdAt}`);
      console.log(`     UserRoles: ${role._count.userRoles}, DeptRoles: ${role._count.userDepartmentRoles}`);
    });

    // 3. Check for cross-tenant role assignments
    console.log('\n🚨 CROSS-TENANT ROLE ASSIGNMENT ANALYSIS:');
    
    // Find users in Wilson's tenant with roles from other tenants
    const crossTenantAssignments = await prisma.userDepartmentRole.findMany({
      where: {
        user: { tenantId },
        role: { tenantId: { not: tenantId } }
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        role: { 
          select: { 
            name: true, 
            tenantId: true,
            tenant: { select: { name: true } }
          } 
        },
        department: { select: { name: true } }
      }
    });

    if (crossTenantAssignments.length > 0) {
      console.log(`❌ Found ${crossTenantAssignments.length} CROSS-TENANT role assignments:`);
      crossTenantAssignments.forEach((assignment, index) => {
        console.log(`  ${index + 1}. ${assignment.user.firstName} ${assignment.user.lastName}`);
        console.log(`     Role: ${assignment.role.name} from ${assignment.role.tenant.name}`);
        console.log(`     Department: ${assignment.department?.name || 'No Department'}`);
        console.log(`     Role Tenant: ${assignment.role.tenantId}`);
      });
    } else {
      console.log('✅ No cross-tenant department role assignments found');
    }

    // Also check userRoles
    const crossTenantUserRoles = await prisma.userRole.findMany({
      where: {
        user: { tenantId },
        role: { tenantId: { not: tenantId } }
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        role: { 
          select: { 
            name: true, 
            tenantId: true,
            tenant: { select: { name: true } }
          } 
        }
      }
    });

    if (crossTenantUserRoles.length > 0) {
      console.log(`\n❌ Found ${crossTenantUserRoles.length} CROSS-TENANT user role assignments:`);
      crossTenantUserRoles.forEach((assignment, index) => {
        console.log(`  ${index + 1}. ${assignment.user.firstName} ${assignment.user.lastName}`);
        console.log(`     Role: ${assignment.role.name} from ${assignment.role.tenant.name}`);
        console.log(`     Role Tenant: ${assignment.role.tenantId}`);
      });
    } else {
      console.log('✅ No cross-tenant user role assignments found');
    }

    // 4. Analyze predefined roles vs tenant-specific roles
    console.log('\n📋 PREDEFINED vs TENANT-SPECIFIC ROLES:');
    
    const { getAvailableRoles } = require('../constants/rolePermissions');
    const predefinedRoles = getAvailableRoles();
    
    console.log('Predefined role templates:', predefinedRoles);
    
    tenantRoles.forEach(role => {
      const isPredefined = predefinedRoles.includes(role.name.toUpperCase());
      console.log(`  ${role.name}: ${isPredefined ? 'PREDEFINED' : 'CUSTOM'}`);
    });

    // 5. Check Wilson's specific situation
    console.log('\n🔍 WILSON\'S ROLE ANALYSIS:');
    const wilson = await prisma.user.findFirst({
      where: { firstName: { contains: 'wilson', mode: 'insensitive' } },
      include: {
        userDepartmentRoles: {
          include: {
            role: { 
              include: { 
                tenant: { select: { name: true, domain: true } } 
              } 
            },
            department: { select: { name: true } }
          }
        }
      }
    });

    if (wilson) {
      console.log(`Wilson's Tenant: ${wilson.tenantId}`);
      wilson.userDepartmentRoles.forEach((udr, index) => {
        const isCorrectTenant = udr.role.tenantId === wilson.tenantId;
        console.log(`  ${index + 1}. Role: ${udr.role.name} in ${udr.department?.name || 'No Dept'}`);
        console.log(`     Role Tenant: ${udr.role.tenantId} (${udr.role.tenant.name})`);
        console.log(`     Correct Tenant: ${isCorrectTenant ? 'YES' : 'NO'}`);
        if (!isCorrectTenant) {
          console.log(`     🚨 MISMATCH: Role belongs to different tenant!`);
        }
      });
    }

    // 6. Recommendations
    console.log('\n💡 ARCHITECTURAL ISSUES & RECOMMENDATIONS:');
    console.log('1. CROSS-TENANT CONTAMINATION: Users have roles from different tenants');
    console.log('2. DUPLICATE ROLE NAMES: Multiple roles with same name across tenants');
    console.log('3. MISSING TENANT VALIDATION: Role assignment doesn\'t validate tenant boundaries');
    console.log('4. HOD ASSIGNMENT LOGIC: Fails due to role ID mismatches');
    
    console.log('\n🛠️  REQUIRED FIXES:');
    console.log('1. Add tenant validation to all role assignment operations');
    console.log('2. Update Wilson to use correct tenant-specific HOD role');
    console.log('3. Add migration to fix all cross-tenant role assignments');
    console.log('4. Enhance HOD assignment logic with tenant-aware role lookups');
    console.log('5. Add database constraints to prevent cross-tenant assignments');

  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

comprehensiveRoleArchitectureAnalysis();
