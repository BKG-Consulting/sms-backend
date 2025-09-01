#!/usr/bin/env node

/**
 * Debug MR Permissions
 * 
 * This script checks if the MR role has the auditProgram:commit permission
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugMRPermissions() {
  try {
    console.log('🔍 Debugging MR Permissions...\n');

    // 1. Find the MR role
    const mrRole = await prisma.role.findFirst({
      where: { name: 'MR' }
    });

    if (!mrRole) {
      console.log('❌ MR role not found in database');
      return;
    }

    console.log('✅ MR role found:', {
      id: mrRole.id,
      name: mrRole.name,
      tenantId: mrRole.tenantId
    });

    // 2. Find the auditProgram:commit permission
    const commitPermission = await prisma.permission.findFirst({
      where: {
        module: 'auditProgram',
        action: 'commit'
      }
    });

    if (!commitPermission) {
      console.log('❌ auditProgram:commit permission not found in database');
      return;
    }

    console.log('✅ auditProgram:commit permission found:', {
      id: commitPermission.id,
      module: commitPermission.module,
      action: commitPermission.action
    });

    // 3. Check if MR role has this permission
    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: mrRole.id,
        permissionId: commitPermission.id
      }
    });

    if (!rolePermission) {
      console.log('❌ MR role does NOT have auditProgram:commit permission');
      
      // Check what permissions MR role actually has
      const mrPermissions = await prisma.rolePermission.findMany({
        where: { roleId: mrRole.id },
        include: {
          permission: true
        }
      });

      console.log('📋 MR role permissions:', mrPermissions.map(rp => ({
        permission: `${rp.permission.module}:${rp.permission.action}`,
        allowed: rp.allowed
      })));

      return;
    }

    console.log('✅ MR role HAS auditProgram:commit permission:', {
      rolePermissionId: rolePermission.id,
      allowed: rolePermission.allowed
    });

    // 4. Check specific user (from the debug logs)
    const userId = 'b354a8f9-31a4-480b-ba33-9d16022772c4';
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: { role: true }
        },
        userDepartmentRoles: {
          include: { role: true }
        }
      }
    });

    if (!user) {
      console.log('❌ User not found:', userId);
      return;
    }

    console.log('👤 User found:', {
      id: user.id,
      email: user.email,
      userRoles: user.userRoles.map(ur => ur.role.name),
      userDepartmentRoles: user.userDepartmentRoles.map(udr => udr.role.name)
    });

    // 5. Check if user has MR role
    const userMRRole = user.userRoles.find(ur => ur.role.name === 'MR');
    if (!userMRRole) {
      console.log('❌ User does not have MR role assigned in database');
    } else {
      console.log('✅ User has MR role assigned in database');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugMRPermissions(); 