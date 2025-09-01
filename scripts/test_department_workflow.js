/**
 * Test the complete department creation workflow
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDepartmentWorkflow() {
  console.log('🧪 Testing complete department creation workflow...\n');

  try {
    // 1. Check current tenant-campus structure
    console.log('📊 Current tenant-campus structure:');
    
    const tenants = await prisma.tenant.findMany({
      include: {
        campuses: {
          select: {
            id: true,
            name: true,
            isMain: true,
            _count: {
              select: {
                departments: true
              }
            }
          }
        }
      }
    });

    tenants.forEach(tenant => {
      console.log(`\n🏢 ${tenant.name}:`);
      tenant.campuses.forEach(campus => {
        const mainLabel = campus.isMain ? ' (Main)' : '';
        console.log(`   📍 ${campus.name}${mainLabel} - ${campus._count.departments} departments`);
      });
    });

    // 2. Test department creation with the updated service
    console.log('\n\n🧪 Testing department creation without explicit campus...');
    
    // Find a tenant to test with
    const testTenant = tenants[0];
    if (!testTenant) {
      console.log('❌ No tenants found for testing');
      return;
    }

    console.log(`📝 Creating test department in "${testTenant.name}"`);

    // Import the department service
    const { createDepartment } = require('../src/services/department.service.js');

    // Test creating a department without specifying campusId
    const newDepartment = await createDepartment({
      name: 'Test Engineering Department',
      code: 'ENG',
      tenantId: testTenant.id
      // Note: No campusId specified - should auto-assign to main campus
    });

    console.log(`✅ Department created successfully:`);
    console.log(`   - ID: ${newDepartment.id}`);
    console.log(`   - Name: ${newDepartment.name}`);
    console.log(`   - Campus: ${newDepartment.campus?.name || 'No campus'}`);
    console.log(`   - Campus ID: ${newDepartment.campusId}`);

    // 3. Verify the department is properly linked
    const verification = await prisma.department.findUnique({
      where: { id: newDepartment.id },
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
      }
    });

    if (verification?.campus) {
      console.log(`\n✅ Verification successful:`);
      console.log(`   - Department "${verification.name}" is linked to campus "${verification.campus.name}"`);
      console.log(`   - Campus is main: ${verification.campus.isMain}`);
    } else {
      console.log(`\n❌ Verification failed: Department not properly linked to campus`);
    }

    // 4. Clean up test department
    console.log(`\n🧹 Cleaning up test department...`);
    await prisma.department.delete({
      where: { id: newDepartment.id }
    });
    console.log(`✅ Test department cleaned up`);

    // 5. Final department count check
    console.log('\n📊 Final department-campus relationships:');
    
    const finalDepartments = await prisma.department.findMany({
      include: {
        campus: {
          select: {
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

    finalDepartments.forEach(dept => {
      const campusInfo = dept.campus 
        ? `${dept.campus.name}${dept.campus.isMain ? ' (Main)' : ''}`
        : '❌ NO CAMPUS';
      
      console.log(`   ${dept.tenant.name} → ${dept.name} → ${campusInfo}`);
    });

    console.log('\n✅ Workflow test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing department workflow:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDepartmentWorkflow();
