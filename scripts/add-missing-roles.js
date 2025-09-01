require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addMissingRoles() {
  console.log('Adding missing roles and permissions...');

  try {
    // Find the default tenant
    const tenant = await prisma.tenant.findFirst({
      where: { id: 'default-tenant' }
    });

    if (!tenant) {
      console.error('Default tenant not found');
      return;
    }

    // Add MR role
    const mrRoleId = `${tenant.id}-mr`;
    const mrRole = await prisma.role.upsert({
      where: { id: mrRoleId },
      update: {},
      create: {
        id: mrRoleId,
        name: 'MR',
        description: 'Management Representative for audit management',
        tenantId: tenant.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log('✅ MR role created:', mrRole.id);

    // Add PRINCIPAL role
    const principalRoleId = `${tenant.id}-principal`;
    const principalRole = await prisma.role.upsert({
      where: { id: principalRoleId },
      update: {},
      create: {
        id: principalRoleId,
        name: 'PRINCIPAL',
        description: 'Principal for audit approval',
        tenantId: tenant.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log('✅ PRINCIPAL role created:', principalRole.id);

    // Add AUDITOR role
    const auditorRoleId = `${tenant.id}-auditor`;
    const auditorRole = await prisma.role.upsert({
      where: { id: auditorRoleId },
      update: {},
      create: {
        id: auditorRoleId,
        name: 'AUDITOR',
        description: 'Auditor for conducting audits',
        tenantId: tenant.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log('✅ AUDITOR role created:', auditorRole.id);

    // Add TEAM_LEADER role
    const teamLeaderRoleId = `${tenant.id}-team_leader`;
    const teamLeaderRole = await prisma.role.upsert({
      where: { id: teamLeaderRoleId },
      update: {},
      create: {
        id: teamLeaderRoleId,
        name: 'TEAM_LEADER',
        description: 'Team Leader for audit teams',
        tenantId: tenant.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    console.log('✅ TEAM_LEADER role created:', teamLeaderRole.id);

    // Grant audit permissions to MR role
    const auditPermissions = await prisma.permission.findMany({
      where: {
        module: { in: ['audit', 'auditProgram'] }
      }
    });

    for (const permission of auditPermissions) {
      await prisma.rolePermission.upsert({
        where: { 
          roleId_permissionId: { 
            roleId: mrRole.id, 
            permissionId: permission.id 
          } 
        },
        update: {},
        create: {
          roleId: mrRole.id,
          permissionId: permission.id,
          allowed: true,
        },
      });
    }
    console.log(`✅ Granted ${auditPermissions.length} audit permissions to MR role`);

    // Grant approval permissions to PRINCIPAL role
    const approvalPermissions = await prisma.permission.findMany({
      where: {
        action: { in: ['approve', 'review'] }
      }
    });

    for (const permission of approvalPermissions) {
      await prisma.rolePermission.upsert({
        where: { 
          roleId_permissionId: { 
            roleId: principalRole.id, 
            permissionId: permission.id 
          } 
        },
        update: {},
        create: {
          roleId: principalRole.id,
          permissionId: permission.id,
          allowed: true,
        },
      });
    }
    console.log(`✅ Granted ${approvalPermissions.length} approval permissions to PRINCIPAL role`);

    console.log('✅ All missing roles and permissions added successfully!');

  } catch (error) {
    console.error('❌ Error adding missing roles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addMissingRoles(); 