const { prisma } = require('../prisma/client');

async function fixWilsonRoleAssignment() {
  try {
    console.log('=== FIXING WILSON\'S CROSS-TENANT ROLE ASSIGNMENT ===\n');
    
    const wilsonId = 'adace105-774b-4662-893b-e018cfd3b89b';
    const wilsonTenantId = '40bbcd5e-2eb9-4c18-ad83-55a96db87003';
    const researchDeptId = '9532aba6-2211-48dd-97dd-c3e24ed237d1';
    
    // Get correct HOD role for Wilson's tenant
    const correctHodRole = await prisma.role.findFirst({
      where: {
        tenantId: wilsonTenantId,
        name: 'HOD'
      }
    });
    
    if (!correctHodRole) {
      console.log('❌ No HOD role found for Wilson\'s tenant');
      return;
    }
    
    console.log('✅ Found correct HOD role:', {
      id: correctHodRole.id,
      name: correctHodRole.name,
      tenantId: correctHodRole.tenantId
    });
    
    // Update Wilson's department role assignment
    await prisma.$transaction(async (tx) => {
      // 1. Delete Wilson's current wrong department role
      const deletedRoles = await tx.userDepartmentRole.deleteMany({
        where: {
          userId: wilsonId,
          departmentId: researchDeptId
        }
      });
      
      console.log(`✅ Deleted ${deletedRoles.count} incorrect department role(s)`);
      
      // 2. Create correct department role assignment
      const newDeptRole = await tx.userDepartmentRole.create({
        data: {
          userId: wilsonId,
          departmentId: researchDeptId,
          roleId: correctHodRole.id,
          isPrimaryDepartment: false,
          isPrimaryRole: false
        }
      });
      
      console.log('✅ Created new correct department role assignment');
      
      // 3. Update department hodId (this should have happened automatically but let's ensure it)
      const updatedDept = await tx.department.update({
        where: { id: researchDeptId },
        data: { hodId: wilsonId }
      });
      
      console.log('✅ Updated department hodId to Wilson');
      
      return { newDeptRole, updatedDept };
    });
    
    // 4. Verify the fix
    console.log('\n=== VERIFICATION ===');
    const verification = await prisma.user.findUnique({
      where: { id: wilsonId },
      include: {
        userDepartmentRoles: {
          include: {
            role: { select: { id: true, name: true, tenantId: true } },
            department: { select: { id: true, name: true, hodId: true } }
          }
        }
      }
    });
    
    verification.userDepartmentRoles.forEach((udr, index) => {
      const isCorrectTenant = udr.role.tenantId === wilsonTenantId;
      const isHod = udr.department.hodId === wilsonId;
      console.log(`\nRole ${index + 1}:`);
      console.log(`  Role: ${udr.role.name} (${udr.role.id})`);
      console.log(`  Department: ${udr.department.name}`);
      console.log(`  Correct Tenant: ${isCorrectTenant ? 'YES' : 'NO'}`);
      console.log(`  Is Department HOD: ${isHod ? 'YES' : 'NO'}`);
      
      if (isCorrectTenant && isHod) {
        console.log('  ✅ ROLE ASSIGNMENT IS NOW CORRECT!');
      }
    });
    
  } catch (error) {
    console.error('Error fixing Wilson\'s role:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixWilsonRoleAssignment();
