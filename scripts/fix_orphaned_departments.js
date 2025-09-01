/**
 * Fix orphaned departments by linking them to their tenant's main campus
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixOrphanedDepartments() {
  console.log('🔍 Starting orphaned departments fix...\n');

  try {
    // Find all departments without a campus
    const orphanedDepartments = await prisma.department.findMany({
      where: {
        campusId: null
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`📊 Found ${orphanedDepartments.length} orphaned departments:\n`);

    if (orphanedDepartments.length === 0) {
      console.log('✅ No orphaned departments found!');
      return;
    }

    // Process each orphaned department
    for (const department of orphanedDepartments) {
      console.log(`🏢 Processing department: "${department.name}" in tenant "${department.tenant.name}"`);
      
      // Find the main campus for this tenant
      const mainCampus = await prisma.campus.findFirst({
        where: {
          tenantId: department.tenantId,
          isMain: true
        }
      });

      if (mainCampus) {
        // Link department to main campus
        await prisma.department.update({
          where: { id: department.id },
          data: { campusId: mainCampus.id }
        });
        
        console.log(`   ✅ Linked to main campus: "${mainCampus.name}" (ID: ${mainCampus.id})`);
      } else {
        console.log(`   ❌ No main campus found for tenant "${department.tenant.name}"`);
        
        // Create a main campus for this tenant
        console.log(`   🏗️  Creating main campus for tenant "${department.tenant.name}"`);
        
        const newMainCampus = await prisma.campus.create({
          data: {
            name: 'Main Campus',
            tenantId: department.tenantId,
            isMain: true,
            address: `${department.tenant.name} Main Campus`,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        // Now link the department
        await prisma.department.update({
          where: { id: department.id },
          data: { campusId: newMainCampus.id }
        });
        
        console.log(`   ✅ Created main campus and linked department`);
      }
      
      console.log('');
    }

    // Verify the fix
    console.log('🔄 Verifying fix...\n');
    
    const remainingOrphaned = await prisma.department.findMany({
      where: { campusId: null },
      select: { id: true, name: true }
    });

    if (remainingOrphaned.length === 0) {
      console.log('✅ All departments are now properly linked to campuses!');
    } else {
      console.log(`❌ Still have ${remainingOrphaned.length} orphaned departments:`);
      remainingOrphaned.forEach(dept => {
        console.log(`   - ${dept.name} (ID: ${dept.id})`);
      });
    }

    // Show current state
    console.log('\n📊 Current department-campus relationships:');
    
    const allDepartments = await prisma.department.findMany({
      include: {
        campus: {
          select: {
            id: true,
            name: true,
            isMain: true
          }
        },
        tenant: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { tenant: { name: 'asc' } },
        { name: 'asc' }
      ]
    });

    allDepartments.forEach(dept => {
      const campusInfo = dept.campus 
        ? `${dept.campus.name}${dept.campus.isMain ? ' (Main)' : ''}`
        : 'NO CAMPUS';
      
      console.log(`   ${dept.tenant.name} → ${dept.name} → ${campusInfo}`);
    });

  } catch (error) {
    console.error('❌ Error fixing orphaned departments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixOrphanedDepartments();
