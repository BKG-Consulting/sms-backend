/**
 * Ensure all tenants have at least a main campus
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function ensureTenantsHaveCampuses() {
  console.log('🏢 Ensuring all tenants have campuses...\n');

  try {
    // Find tenants without campuses
    const tenantsWithoutCampuses = await prisma.tenant.findMany({
      where: {
        campuses: {
          none: {}
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    console.log(`📊 Found ${tenantsWithoutCampuses.length} tenants without campuses:`);
    
    if (tenantsWithoutCampuses.length === 0) {
      console.log('✅ All tenants already have campuses!');
    } else {
      tenantsWithoutCampuses.forEach(tenant => {
        console.log(`   - ${tenant.name} (ID: ${tenant.id})`);
      });
    }

    // Create main campus for each tenant without campuses
    for (const tenant of tenantsWithoutCampuses) {
      console.log(`\n🏗️  Creating main campus for "${tenant.name}"`);
      
      const mainCampus = await prisma.campus.create({
        data: {
          name: 'Main Campus',
          tenantId: tenant.id,
          isMain: true,
          address: `${tenant.name} Main Campus`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`✅ Created main campus: "${mainCampus.name}" (ID: ${mainCampus.id})`);
    }

    // Now check if any departments need to be linked to newly created campuses
    console.log('\n🔍 Checking for departments that need campus linking...');
    
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

    console.log(`📊 Found ${orphanedDepartments.length} orphaned departments`);

    for (const department of orphanedDepartments) {
      const mainCampus = await prisma.campus.findFirst({
        where: {
          tenantId: department.tenantId,
          isMain: true
        }
      });

      if (mainCampus) {
        await prisma.department.update({
          where: { id: department.id },
          data: { campusId: mainCampus.id }
        });
        
        console.log(`   ✅ Linked "${department.name}" to "${mainCampus.name}"`);
      }
    }

    // Final verification
    console.log('\n📊 Final tenant-campus-department structure:');
    
    const allTenants = await prisma.tenant.findMany({
      include: {
        campuses: {
          select: {
            id: true,
            name: true,
            isMain: true,
            departments: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    allTenants.forEach(tenant => {
      console.log(`\n🏢 ${tenant.name}:`);
      if (tenant.campuses.length === 0) {
        console.log('   ❌ NO CAMPUSES');
      } else {
        tenant.campuses.forEach(campus => {
          const mainLabel = campus.isMain ? ' (Main)' : '';
          console.log(`   📍 ${campus.name}${mainLabel} - ${campus.departments.length} departments`);
          campus.departments.forEach(dept => {
            console.log(`      - ${dept.name}`);
          });
        });
      }
    });

    console.log('\n✅ All tenants now have proper campus structure!');

  } catch (error) {
    console.error('❌ Error ensuring campus structure:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
ensureTenantsHaveCampuses();
