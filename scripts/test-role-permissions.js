require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { getRolePermissions, getFlattenedPermissions, getAvailableRoles } = require('../constants/rolePermissions');
const rolePermissionService = require('../src/services/rolePermissionService');

const prisma = new PrismaClient();

async function testRolePermissions() {
  console.log('🧪 Testing Role-Permission Matrix System...\n');

  try {
    // Test 1: Check available roles
    console.log('1. Available Predefined Roles:');
    const availableRoles = getAvailableRoles();
    availableRoles.forEach(role => {
      const config = getRolePermissions(role);
      console.log(`   ✅ ${role}: ${config.description}`);
    });
    console.log('');

    // Test 2: Check MR role permissions
    console.log('2. MR Role Permissions:');
    const mrPermissions = getFlattenedPermissions('MR');
    console.log(`   Total permissions: ${mrPermissions.length}`);
    console.log('   Sample permissions:');
    mrPermissions.slice(0, 5).forEach(perm => {
      console.log(`   - ${perm.module}:${perm.action}`);
    });
    console.log('');

    // Test 3: Check database permissions
    console.log('3. Database Permissions:');
    const dbPermissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }]
    });
    console.log(`   Total database permissions: ${dbPermissions.length}`);
    console.log('   Sample database permissions:');
    dbPermissions.slice(0, 5).forEach(perm => {
      console.log(`   - ${perm.module}:${perm.action}`);
    });
    console.log('');

    // Test 4: Find default tenant
    console.log('4. Finding Default Tenant:');
    const tenant = await prisma.tenant.findFirst({
      where: { id: 'default-tenant' }
    });
    if (tenant) {
      console.log(`   ✅ Found tenant: ${tenant.name} (${tenant.id})`);
    } else {
      console.log('   ❌ Default tenant not found');
      return;
    }
    console.log('');

    // Test 5: Create MR role if it doesn't exist
    console.log('5. Creating MR Role:');
    const mrRoleId = `${tenant.id}-mr`;
    let mrRole = await prisma.role.findUnique({
      where: { id: mrRoleId }
    });

    if (!mrRole) {
      mrRole = await prisma.role.create({
        data: {
          id: mrRoleId,
          name: 'MR',
          description: 'Management Representative for audit management and oversight',
          tenantId: tenant.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });
      console.log(`   ✅ Created MR role: ${mrRole.id}`);
    } else {
      console.log(`   ✅ MR role already exists: ${mrRole.id}`);
    }
    console.log('');

    // Test 6: Assign permissions to MR role
    console.log('6. Assigning Permissions to MR Role:');
    try {
      const result = await rolePermissionService.assignPermissionsToRole(
        mrRole.id, 
        'MR', 
        tenant.id
      );
      console.log(`   ✅ Successfully assigned ${result.assignedCount} permissions`);
      console.log(`   Message: ${result.message}`);
    } catch (error) {
      console.log(`   ❌ Failed to assign permissions: ${error.message}`);
    }
    console.log('');

    // Test 7: Verify assigned permissions
    console.log('7. Verifying Assigned Permissions:');
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: mrRole.id },
      include: { permission: true }
    });
    console.log(`   Total assigned permissions: ${rolePermissions.length}`);
    console.log('   Sample assigned permissions:');
    rolePermissions.slice(0, 5).forEach(rp => {
      console.log(`   - ${rp.permission.module}:${rp.permission.action} (${rp.allowed ? 'ALLOWED' : 'DENIED'})`);
    });
    console.log('');

    // Test 8: Test permission checking
    console.log('8. Testing Permission Matrix:');
    const testPermissions = [
      { module: 'audit', action: 'assign' },
      { module: 'audit', action: 'create' },
      { module: 'user', action: 'read' },
      { module: 'document', action: 'create' }
    ];

    testPermissions.forEach(testPerm => {
      const hasPermission = mrPermissions.some(
        p => p.module === testPerm.module && p.action === testPerm.action
      );
      console.log(`   ${testPerm.module}:${testPerm.action} - ${hasPermission ? '✅ INCLUDED' : '❌ NOT INCLUDED'}`);
    });

    console.log('\n🎉 Role-Permission Matrix Test Completed Successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testRolePermissions(); 