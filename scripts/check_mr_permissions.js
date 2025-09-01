const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMrPermissions() {
  try {
    console.log('🔍 Checking MR role permissions...');
    
    const tenantId = 'e4ac3039-43bf-4979-9659-b62ff26939d0'; // Runyenjes tenant
    const mrRoleId = '5e150f95-65ec-4b07-ab3b-db72efc1eed0'; // MR role ID
    
    // Get all permissions for the MR role in this tenant
    const mrPermissions = await prisma.rolePermission.findMany({
      where: {
        roleId: mrRoleId,
        allowed: true
      },
      include: {
        permission: {
          select: {
            id: true,
            module: true,
            action: true,
            description: true
          }
        }
      },
      orderBy: [
        { permission: { module: 'asc' } },
        { permission: { action: 'asc' } }
      ]
    });
    
    console.log(`\n📋 MR role permissions in tenant (${mrPermissions.length} total):`);
    if (mrPermissions.length === 0) {
      console.log('❌ No permissions assigned to MR role');
    } else {
      mrPermissions.forEach(rp => {
        console.log(`  - ${rp.permission.module}:${rp.permission.action} - ${rp.permission.description}`);
      });
    }
    
    // Check specifically for auditProgram permissions
    const auditProgramPermissions = mrPermissions.filter(rp => 
      rp.permission.module === 'auditProgram'
    );
    
    console.log(`\n🎯 auditProgram permissions for MR role (${auditProgramPermissions.length}):`);
    if (auditProgramPermissions.length === 0) {
      console.log('❌ No auditProgram permissions assigned to MR role');
      console.log('💡 The MR role needs auditProgram:commit permission to submit audit programs');
    } else {
      auditProgramPermissions.forEach(rp => {
        console.log(`  - ${rp.permission.action}: ${rp.permission.description}`);
      });
    }
    
    // Check if auditProgram:commit permission exists globally
    const commitPermission = await prisma.permission.findFirst({
      where: { module: 'auditProgram', action: 'commit' }
    });
    
    if (commitPermission) {
      console.log('\n✅ auditProgram:commit permission exists globally');
      
      // Check if it's assigned to MR role
      const mrHasCommitPermission = await prisma.rolePermission.findFirst({
        where: {
          roleId: mrRoleId,
          permissionId: commitPermission.id,
          allowed: true
        }
      });
      
      if (mrHasCommitPermission) {
        console.log('✅ MR role has auditProgram:commit permission');
      } else {
        console.log('❌ MR role does NOT have auditProgram:commit permission');
        console.log('💡 Solution: Assign auditProgram:commit permission to MR role via permission matrix');
      }
    } else {
      console.log('❌ auditProgram:commit permission does not exist globally');
    }
    
  } catch (error) {
    console.error('❌ Error checking MR permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMrPermissions(); 