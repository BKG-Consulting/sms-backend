#!/usr/bin/env node

/**
 * Fix MR Role ID Mismatch
 * 
 * This script fixes the MR role ID mismatch between JWT token and database
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixMRRoleId() {
  try {
    console.log('🔧 Fixing MR Role ID Mismatch...\n');

    // The correct MR role ID from JWT token
    const correctMRRoleId = '5e150f95-65ec-4b07-ab3b-db72efc1eed0';
    
    // Find the current MR role in database
    const currentMRRole = await prisma.role.findFirst({
      where: { name: 'MR' }
    });

    if (!currentMRRole) {
      console.log('❌ MR role not found in database');
      return;
    }

    console.log('Current MR Role:', {
      id: currentMRRole.id,
      name: currentMRRole.name,
      tenantId: currentMRRole.tenantId
    });

    // Check if the correct ID already exists
    const existingCorrectRole = await prisma.role.findUnique({
      where: { id: correctMRRoleId }
    });

    if (existingCorrectRole) {
      console.log('⚠️  Role with correct ID already exists:', {
        id: existingCorrectRole.id,
        name: existingCorrectRole.name
      });

      if (existingCorrectRole.name === 'MR') {
        console.log('✅ Correct MR role already exists with proper ID');
        return;
      } else {
        console.log('❌ Role with correct ID exists but has different name:', existingCorrectRole.name);
        return;
      }
    }

    // Update the MR role ID
    console.log('🔄 Updating MR role ID...');
    
    const updatedMRRole = await prisma.role.update({
      where: { id: currentMRRole.id },
      data: { id: correctMRRoleId }
    });

    console.log('✅ MR role updated:', {
      id: updatedMRRole.id,
      name: updatedMRRole.name
    });

    // Verify the role permissions are still intact
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: correctMRRoleId },
      include: { permission: true }
    });

    console.log('✅ Role permissions verified:', rolePermissions.length, 'permissions found');

    // Update user role assignments
    console.log('🔄 Updating user role assignments...');
    
    const updatedUserRoles = await prisma.userRole.updateMany({
      where: { roleId: currentMRRole.id },
      data: { roleId: correctMRRoleId }
    });

    console.log('✅ User role assignments updated:', updatedUserRoles.count, 'assignments');

    console.log('🎉 MR role ID fix completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing MR role ID:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMRRoleId(); 