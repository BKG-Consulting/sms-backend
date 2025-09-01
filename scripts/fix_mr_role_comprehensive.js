#!/usr/bin/env node

/**
 * Comprehensive MR Role Fix
 * 
 * This script fixes the MR role ID mismatch by creating the correct role
 * with the proper ID and migrating all permissions and user assignments.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixMRRoleComprehensive() {
  try {
    console.log('🔧 Comprehensive MR Role Fix...\n');

    // The correct MR role ID from JWT token
    const correctMRRoleId = '5e150f95-65ec-4b07-ab3b-db72efc1eed0';
    const tenantId = 'e4ac3039-43bf-4979-9659-b62ff26939d0'; // From JWT token
    
    console.log('Target Configuration:');
    console.log('  Correct MR Role ID:', correctMRRoleId);
    console.log('  Tenant ID:', tenantId);
    console.log('');

    // 1. Check if the correct role already exists
    const existingCorrectRole = await prisma.role.findUnique({
      where: { id: correctMRRoleId }
    });

    if (existingCorrectRole) {
      console.log('⚠️  Role with correct ID already exists:', {
        id: existingCorrectRole.id,
        name: existingCorrectRole.name,
        tenantId: existingCorrectRole.tenantId
      });

      if (existingCorrectRole.name === 'MR' && existingCorrectRole.tenantId === tenantId) {
        console.log('✅ Correct MR role already exists with proper ID and tenant');
        
        // Check if it has the required permissions
        const permissions = await prisma.rolePermission.findMany({
          where: { 
            roleId: correctMRRoleId,
            permission: {
              module: 'auditProgram',
              action: 'commit'
            }
          }
        });
        
        if (permissions.length > 0) {
          console.log('✅ MR role has auditProgram:commit permission');
          return;
        } else {
          console.log('❌ MR role missing auditProgram:commit permission');
        }
      } else {
        console.log('❌ Role with correct ID exists but has wrong name or tenant');
        return;
      }
    }

    // 2. Find the current MR role in the target tenant
    const currentMRRole = await prisma.role.findFirst({
      where: { 
        name: 'MR',
        tenantId: tenantId
      }
    });

    if (!currentMRRole) {
      console.log('❌ MR role not found in target tenant');
      return;
    }

    console.log('Current MR Role:', {
      id: currentMRRole.id,
      name: currentMRRole.name,
      tenantId: currentMRRole.tenantId
    });

    // 3. Get all permissions for the current MR role
    const currentPermissions = await prisma.rolePermission.findMany({
      where: { roleId: currentMRRole.id },
      include: { permission: true }
    });

    console.log('Current MR permissions:', currentPermissions.length);

    // 4. Get all user assignments for the current MR role
    const currentUserRoles = await prisma.userRole.findMany({
      where: { roleId: currentMRRole.id },
      include: { user: true }
    });

    console.log('Current MR user assignments:', currentUserRoles.length);

    // 5. Create the new MR role with correct ID
    console.log('🔄 Creating new MR role with correct ID...');
    
    const newMRRole = await prisma.role.create({
      data: {
        id: correctMRRoleId,
        name: 'MR',
        description: 'Management Representative',
        tenantId: tenantId
      }
    });

    console.log('✅ New MR role created:', {
      id: newMRRole.id,
      name: newMRRole.name,
      tenantId: newMRRole.tenantId
    });

    // 6. Copy all permissions to the new role
    console.log('🔄 Copying permissions to new role...');
    
    for (const permission of currentPermissions) {
      await prisma.rolePermission.create({
        data: {
          roleId: correctMRRoleId,
          permissionId: permission.permissionId,
          allowed: permission.allowed
        }
      });
    }

    console.log('✅ Permissions copied:', currentPermissions.length);

    // 7. Update user role assignments
    console.log('🔄 Updating user role assignments...');
    
    for (const userRole of currentUserRoles) {
      await prisma.userRole.update({
        where: { id: userRole.id },
        data: { roleId: correctMRRoleId }
      });
    }

    console.log('✅ User assignments updated:', currentUserRoles.length);

    // 8. Delete the old role (optional - for cleanup)
    console.log('🔄 Cleaning up old role...');
    
    await prisma.role.delete({
      where: { id: currentMRRole.id }
    });

    console.log('✅ Old role deleted');

    // 9. Verify the fix
    console.log('🔄 Verifying the fix...');
    
    const verificationRole = await prisma.role.findUnique({
      where: { id: correctMRRoleId },
      include: {
        rolePermissions: {
          include: { permission: true }
        },
        userRoles: {
          include: { user: true }
        }
      }
    });

    if (verificationRole) {
      console.log('✅ Verification successful:');
      console.log('  Role ID:', verificationRole.id);
      console.log('  Role Name:', verificationRole.name);
      console.log('  Tenant ID:', verificationRole.tenantId);
      console.log('  Permissions:', verificationRole.rolePermissions.length);
      console.log('  User Assignments:', verificationRole.userRoles.length);
      
      // Check for specific permission
      const commitPermission = verificationRole.rolePermissions.find(rp => 
        rp.permission.module === 'auditProgram' && rp.permission.action === 'commit'
      );
      
      if (commitPermission) {
        console.log('✅ auditProgram:commit permission verified');
      } else {
        console.log('❌ auditProgram:commit permission missing');
      }
    }

    console.log('🎉 Comprehensive MR role fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing MR role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMRRoleComprehensive(); 