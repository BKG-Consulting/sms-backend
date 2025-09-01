const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugTenantRoles() {
  try {
    console.log('🔍 Debugging tenant roles...');
    
    const tenantId = 'e4ac3039-43bf-4979-9659-b62ff26939d0'; // Runyenjes tenant
    const jwtMrRoleId = '5e150f95-65ec-4b07-ab3b-db72efc1eed0'; // MR role ID from JWT
    
    console.log('📋 Target tenant ID:', tenantId);
    console.log('🎯 JWT MR role ID:', jwtMrRoleId);
    
    // Get all roles in the tenant
    const tenantRoles = await prisma.role.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });
    
    console.log('\n📚 All roles in tenant:');
    tenantRoles.forEach(role => {
      console.log(`  - ${role.name}: ${role.id} (default: ${role.isDefault})`);
    });
    
    // Check if the JWT MR role ID exists in this tenant
    const jwtRoleInTenant = tenantRoles.find(role => role.id === jwtMrRoleId);
    if (jwtRoleInTenant) {
      console.log('\n✅ JWT MR role ID found in tenant:', jwtRoleInTenant.name);
    } else {
      console.log('\n❌ JWT MR role ID NOT found in tenant');
      
      // Look for any MR role in the tenant
      const mrRoleInTenant = tenantRoles.find(role => role.name === 'MR');
      if (mrRoleInTenant) {
        console.log('🔍 Found MR role in tenant with different ID:', mrRoleInTenant.id);
        console.log('⚠️  This explains the permission mismatch!');
      } else {
        console.log('❌ No MR role found in tenant at all');
      }
    }
    
    // Check if the user has the MR role assigned
    const userId = 'b354a8f9-31a4-480b-ba33-9d16022772c4';
    const userRoles = await prisma.userRole.findMany({
      where: { 
        userId,
        role: { tenantId }
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            tenantId: true
          }
        }
      }
    });
    
    console.log('\n👤 User role assignments in tenant:');
    userRoles.forEach(userRole => {
      console.log(`  - ${userRole.role.name}: ${userRole.role.id} (tenant: ${userRole.role.tenantId})`);
    });
    
    // Check if the auditProgram:commit permission exists
    const permission = await prisma.permission.findFirst({
      where: { module: 'auditProgram', action: 'commit' }
    });
    
    if (permission) {
      console.log('\n✅ auditProgram:commit permission found:', permission.id);
      
      // Check which roles have this permission
      const rolePermissions = await prisma.rolePermission.findMany({
        where: {
          permissionId: permission.id,
          allowed: true,
          role: { tenantId }
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              tenantId: true
            }
          }
        }
      });
      
      console.log('\n🔐 Roles with auditProgram:commit permission in tenant:');
      rolePermissions.forEach(rp => {
        console.log(`  - ${rp.role.name}: ${rp.role.id}`);
      });
    } else {
      console.log('\n❌ auditProgram:commit permission not found');
    }
    
  } catch (error) {
    console.error('❌ Error debugging tenant roles:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugTenantRoles(); 