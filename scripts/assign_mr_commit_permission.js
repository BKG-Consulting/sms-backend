const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignMrCommitPermission() {
  try {
    console.log('🔧 Assigning auditProgram:commit permission to MR role...');
    
    const tenantId = 'e4ac3039-43bf-4979-9659-b62ff26939d0'; // Runyenjes tenant
    const mrRoleId = '5e150f95-65ec-4b07-ab3b-db72efc1eed0'; // MR role ID
    
    // Get the auditProgram:commit permission
    const commitPermission = await prisma.permission.findFirst({
      where: { module: 'auditProgram', action: 'commit' }
    });
    
    if (!commitPermission) {
      console.log('❌ auditProgram:commit permission not found');
      return;
    }
    
    console.log('✅ Found auditProgram:commit permission:', commitPermission.id);
    
    // Check if the permission is already assigned
    const existingAssignment = await prisma.rolePermission.findFirst({
      where: {
        roleId: mrRoleId,
        permissionId: commitPermission.id
      }
    });
    
    if (existingAssignment) {
      if (existingAssignment.allowed) {
        console.log('✅ auditProgram:commit permission already assigned to MR role');
        return;
      } else {
        console.log('⚠️  auditProgram:commit permission is explicitly denied for MR role');
        console.log('💡 Updating to allow the permission...');
        
        await prisma.rolePermission.update({
          where: { id: existingAssignment.id },
          data: { allowed: true }
        });
        
        console.log('✅ Updated auditProgram:commit permission to allowed for MR role');
        return;
      }
    }
    
    // Assign the permission
    await prisma.rolePermission.create({
      data: {
        roleId: mrRoleId,
        permissionId: commitPermission.id,
        allowed: true
      }
    });
    
    console.log('✅ Successfully assigned auditProgram:commit permission to MR role');
    
    // Verify the assignment
    const verification = await prisma.rolePermission.findFirst({
      where: {
        roleId: mrRoleId,
        permissionId: commitPermission.id,
        allowed: true
      },
      include: {
        role: { select: { name: true, tenantId: true } },
        permission: { select: { module: true, action: true } }
      }
    });
    
    if (verification) {
      console.log('✅ Verification successful:');
      console.log(`   Role: ${verification.role.name} (${verification.role.tenantId})`);
      console.log(`   Permission: ${verification.permission.module}:${verification.permission.action}`);
    } else {
      console.log('❌ Verification failed - permission not found after assignment');
    }
    
  } catch (error) {
    console.error('❌ Error assigning permission:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignMrCommitPermission(); 