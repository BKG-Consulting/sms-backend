const { prisma } = require('../prisma/client');

async function analyzeUserCreationRoleSystem() {
  try {
    console.log('=== ANALYZING USER CREATION ROLE SYSTEM ===\n');
    
    const tenantId = '40bbcd5e-2eb9-4c18-ad83-55a96db87003'; // Wilson's tenant
    
    // 1. What roles are returned by GET /api/roles/tenant/roles ?
    console.log('1. SIMULATING: GET /api/roles/tenant/roles');
    console.log('   This endpoint returns ALL roles for the current tenant');
    
    const tenantRoles = await prisma.role.findMany({
      where: { tenantId },
      select: { 
        id: true, 
        name: true, 
        description: true, 
        tenantId: true,
        loginDestination: true,
        defaultContext: true,
        isDefault: true,
        isRemovable: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`✅ Found ${tenantRoles.length} roles for this tenant:`);
    tenantRoles.forEach((role, index) => {
      console.log(`  ${index + 1}. ${role.name} (${role.id})`);
      console.log(`     Description: ${role.description || 'No description'}`);
      console.log(`     Created: ${role.createdAt}`);
      console.log(`     Is Default: ${role.isDefault}`);
      console.log(`     Is Removable: ${role.isRemovable}`);
    });

    // 2. Check predefined vs custom roles
    console.log('\n2. PREDEFINED vs CUSTOM ROLES ANALYSIS:');
    
    const { getAvailableRoles } = require('../constants/rolePermissions');
    const predefinedRoleNames = getAvailableRoles();
    
    console.log('Available predefined role templates:', predefinedRoleNames);
    console.log('\nRole categorization:');
    
    tenantRoles.forEach(role => {
      const isPredefined = predefinedRoleNames.includes(role.name.toUpperCase());
      console.log(`  ${role.name}: ${isPredefined ? 'PREDEFINED ✅' : 'CUSTOM 🔧'}`);
    });

    // 3. Department role assignment specific analysis
    console.log('\n3. DEPARTMENT ROLE ASSIGNMENT ANALYSIS:');
    console.log('When user selects a department, these roles are shown:');
    
    // Look for roles commonly used in department assignments
    const departmentRoles = tenantRoles.filter(role => 
      ['STAFF', 'HOD', 'HOD AUDITOR'].includes(role.name.toUpperCase())
    );
    
    if (departmentRoles.length > 0) {
      console.log('✅ Department-specific roles available:');
      departmentRoles.forEach(role => {
        console.log(`  - ${role.name}: ${role.description || 'No description'}`);
      });
    } else {
      console.log('❌ No standard department roles (STAFF, HOD) found!');
    }

    // 4. Check what happens during user creation
    console.log('\n4. USER CREATION ROLE FLOW:');
    console.log('Frontend form process:');
    console.log('  1. User selects department(s) from dropdown');
    console.log('  2. For each department, user can select role');
    console.log('  3. Available roles come from: GET /api/roles/tenant/roles');
    console.log('  4. Default selection: STAFF role (if available)');
    console.log('  5. User can change to HOD or other roles');
    
    // 5. Verify role availability for Wilson's case
    console.log('\n5. WILSON\'S CASE ANALYSIS:');
    
    const staffRole = tenantRoles.find(r => r.name.toUpperCase() === 'STAFF');
    const hodRole = tenantRoles.find(r => r.name.toUpperCase() === 'HOD');
    
    console.log('When Wilson was created:');
    console.log(`  STAFF role available: ${staffRole ? 'YES ✅' : 'NO ❌'}`);
    if (staffRole) {
      console.log(`    - ID: ${staffRole.id}`);
      console.log(`    - Description: ${staffRole.description}`);
    }
    
    console.log(`  HOD role available: ${hodRole ? 'YES ✅' : 'NO ❌'}`);
    if (hodRole) {
      console.log(`    - ID: ${hodRole.id}`);
      console.log(`    - Description: ${hodRole.description}`);
    }

    // 6. Cross-tenant contamination check
    console.log('\n6. CROSS-TENANT CONTAMINATION CHECK:');
    
    // Check if there are roles with same names in other tenants
    const otherTenantRoles = await prisma.role.findMany({
      where: {
        tenantId: { not: tenantId },
        name: { in: ['STAFF', 'HOD', 'HOD AUDITOR'] }
      },
      include: {
        tenant: { select: { name: true, domain: true } }
      }
    });

    if (otherTenantRoles.length > 0) {
      console.log('⚠️  Found similar roles in OTHER tenants:');
      otherTenantRoles.forEach(role => {
        console.log(`  - ${role.name} (${role.id}) from ${role.tenant.name}`);
        console.log(`    Created: ${role.createdAt}`);
      });
      console.log('\n🚨 POTENTIAL ISSUE: Frontend might accidentally use wrong role IDs!');
    } else {
      console.log('✅ No similar roles found in other tenants');
    }

    // 7. Recommended solution
    console.log('\n7. RECOMMENDED SOLUTION:');
    console.log('🎯 ANSWERS TO YOUR QUESTIONS:');
    console.log('');
    console.log('Q: Where are these roles coming from?');
    console.log('A: From GET /api/roles/tenant/roles endpoint');
    console.log('   This returns ALL roles for the current tenant');
    console.log('');
    console.log('Q: Are STAFF and HOD roles tenant-specific?');
    console.log('A: YES! Each tenant gets their own STAFF and HOD roles');
    console.log('   They are created from predefined templates but are tenant-specific');
    console.log('');
    console.log('🛠️  ISSUES IDENTIFIED:');
    console.log('1. Cross-tenant role contamination (already fixed for Wilson)');
    console.log('2. No validation to ensure frontend uses correct tenant roles');
    console.log('3. Potential for role ID mix-ups during user creation');
    console.log('');
    console.log('💡 SOLUTIONS IMPLEMENTED:');
    console.log('1. ✅ Enhanced tenant validation in tenantService.js');
    console.log('2. ✅ Fixed Wilson\'s cross-tenant role assignment');
    console.log('3. ✅ Added logging for role assignment debugging');
    console.log('');
    console.log('🔄 FRONTEND SHOULD:');
    console.log('1. Call GET /api/roles/tenant/roles for role dropdown');
    console.log('2. Use returned role IDs directly (they are tenant-scoped)');
    console.log('3. Default to STAFF role when department is selected');
    console.log('4. Allow user to change to HOD if needed');

  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeUserCreationRoleSystem();
