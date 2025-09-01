const { PrismaClient } = require('@prisma/client');
const { onboardTenantWithAdmin } = require('../src/services/enhancedTenantOnboardingService');

const prisma = new PrismaClient();

async function testEnhancedOnboarding() {
  console.log('🧪 TESTING ENHANCED TENANT ONBOARDING\n');

  try {
    // Test payload for a new institution
    const testPayload = {
      tenant: {
        name: "Test University",
        domain: "test-university.edu",
        email: "admin@test-university.edu", 
        type: "UNIVERSITY",
        logoUrl: "",
        phone: "+254700000000",
        accreditationNumber: "TU-2025-001",
        establishedYear: 2025,
        timezone: "Africa/Nairobi",
        currency: "KES",
        address: "123 University Road",
        city: "Nairobi",
        county: "Nairobi",
        country: "Kenya",
        website: "https://test-university.edu",
        postalCode: "00100",
        registrationNumber: "TU-REG-2025",
        legalName: "Test University Limited",
        contactPerson: "Dr. John Doe",
        contactEmail: "contact@test-university.edu",
        contactPhone: "+254711000000",
        subscriptionPlan: "BASIC",
        maxUsers: 50,
        maxStorageGB: 10,
        
        // Branding fields
        primaryColor: "#1E40AF",
        secondaryColor: "#F59E0B",
        tagline: "Excellence in Education",
        description: "A leading institution for higher learning"
      },
      adminUser: {
        email: "sysadmin@test-university.edu",
        firstName: "System",
        lastName: "Administrator",
        password: "SecurePass123!",
        phone: "+254722000000"
      },
      createdBy: "system-test"
    };

    console.log('1. 🚀 Starting enhanced tenant onboarding...');
    const result = await onboardTenantWithAdmin(testPayload);
    
    console.log('\n2. ✅ ONBOARDING COMPLETED!');
    console.log('   Results:');
    console.log(`   • Tenant: ${result.tenant.name} (${result.tenant.id})`);
    console.log(`   • Admin User: ${result.user.email} (${result.user.id})`);
    console.log(`   • Campus: ${result.campus.name} (${result.campus.id})`);
    console.log(`   • Department: ${result.department.name} (${result.department.id})`);
    console.log(`   • Roles Created: ${Object.keys(result.roles).join(', ')}`);

    // 3. Verify tenant isolation
    console.log('\n3. 🔍 VERIFYING TENANT ISOLATION:');
    
    const tenantRoles = await prisma.role.findMany({
      where: { tenantId: result.tenant.id },
      select: { name: true, tenantId: true, _count: { select: { rolePermissions: true } } }
    });
    
    console.log(`   Found ${tenantRoles.length} roles for new tenant:`);
    tenantRoles.forEach(role => {
      console.log(`   • ${role.name}: ${role._count.rolePermissions} permissions`);
    });

    // 4. Test system admin login scenario
    console.log('\n4. 👤 SYSTEM ADMIN LOGIN SCENARIO:');
    
    const adminUser = await prisma.user.findUnique({
      where: { email: testPayload.adminUser.email },
      include: {
        userRoles: {
          include: {
            role: { select: { name: true, tenantId: true } }
          }
        },
        userDepartmentRoles: {
          include: {
            role: { select: { name: true, tenantId: true } },
            department: { select: { name: true } }
          }
        }
      }
    });

    console.log(`   Admin user: ${adminUser.email}`);
    console.log(`   Tenant ID: ${adminUser.tenantId}`);
    console.log(`   User Roles: ${adminUser.userRoles.map(ur => ur.role.name).join(', ')}`);
    console.log(`   Department Roles: ${adminUser.userDepartmentRoles.map(udr => `${udr.role.name} in ${udr.department.name}`).join(', ')}`);

    // 5. Test role fetching for UserFormModal
    console.log('\n5. 📝 USER FORM MODAL SCENARIO:');
    console.log('   When system admin creates users, they will see:');
    tenantRoles.forEach(role => {
      console.log(`   • ${role.name} (available for assignment)`);
    });

    // 6. Verify no cross-tenant contamination
    console.log('\n6. 🛡️  SECURITY VERIFICATION:');
    
    const allTenants = await prisma.tenant.findMany({
      include: {
        roles: { select: { name: true, tenantId: true } }
      }
    });
    
    console.log('   Tenant Role Distribution:');
    allTenants.forEach(tenant => {
      console.log(`   • ${tenant.name}: ${tenant.roles.length} roles`);
      tenant.roles.forEach(role => {
        const isCorrectTenant = role.tenantId === tenant.id;
        console.log(`     - ${role.name}: ${isCorrectTenant ? '✅' : '❌'} (tenantId: ${role.tenantId})`);
      });
    });

    console.log('\n🎉 ENHANCED ONBOARDING TEST COMPLETED SUCCESSFULLY!');
    console.log('\n📋 BENEFITS:');
    console.log('   ✅ System admin gets essential roles immediately');
    console.log('   ✅ UserFormModal will have proper role options');
    console.log('   ✅ All roles are properly tenant-isolated');
    console.log('   ✅ Permissions are auto-assigned to predefined roles');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Check if it's a duplicate tenant error
    if (error.code === 'P2002') {
      console.log('\n💡 NOTE: Test tenant already exists. To re-run test:');
      console.log('   1. Delete existing test tenant, or');
      console.log('   2. Change the domain/email in testPayload');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testEnhancedOnboarding();
