const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeTenantCampusDepartmentRelations() {
  console.log('🔍 ANALYZING TENANT-CAMPUS-DEPARTMENT RELATIONSHIPS\n');

  try {
    // 1. Get all tenants with their campuses and departments
    console.log('1. 📊 TENANT-CAMPUS-DEPARTMENT OVERVIEW:');
    const tenants = await prisma.tenant.findMany({
      include: {
        campuses: {
          select: {
            id: true,
            name: true,
            isMain: true,
            departments: {
              select: {
                id: true,
                name: true,
                code: true,
                campusId: true
              }
            }
          }
        },
        departments: {
          select: {
            id: true,
            name: true,
            code: true,
            campusId: true,
            campus: {
              select: {
                id: true,
                name: true,
                isMain: true
              }
            }
          }
        }
      }
    });

    tenants.forEach(tenant => {
      console.log(`\n📍 TENANT: ${tenant.name} (${tenant.id})`);
      console.log(`   Domain: ${tenant.domain}`);
      
      console.log(`   📍 CAMPUSES (${tenant.campuses.length}):`);
      tenant.campuses.forEach(campus => {
        console.log(`     - ${campus.name} (${campus.id}) ${campus.isMain ? '[MAIN]' : ''}`);
        console.log(`       Departments: ${campus.departments.length}`);
        campus.departments.forEach(dept => {
          console.log(`         • ${dept.name} (${dept.code || 'no code'})`);
        });
      });

      console.log(`   🏢 DEPARTMENTS (${tenant.departments.length}):`);
      const departmentsWithCampus = tenant.departments.filter(d => d.campusId);
      const departmentsWithoutCampus = tenant.departments.filter(d => !d.campusId);
      
      console.log(`     ✅ Linked to Campus: ${departmentsWithCampus.length}`);
      departmentsWithCampus.forEach(dept => {
        console.log(`       • ${dept.name} (${dept.code || 'no code'}) → ${dept.campus?.name || 'Unknown Campus'}`);
      });
      
      if (departmentsWithoutCampus.length > 0) {
        console.log(`     ❌ NOT Linked to Campus: ${departmentsWithoutCampus.length}`);
        departmentsWithoutCampus.forEach(dept => {
          console.log(`       • ${dept.name} (${dept.code || 'no code'}) → NO CAMPUS`);
        });
      }
    });

    // 2. Check for orphaned departments (departments without valid campus)
    console.log('\n2. 🔍 ORPHANED DEPARTMENTS CHECK:');
    const orphanedDepartments = await prisma.department.findMany({
      where: {
        OR: [
          { campusId: null },
          { 
            campusId: { not: null },
            campus: null
          }
        ]
      },
      include: {
        tenant: { select: { name: true } },
        campus: { select: { name: true } }
      }
    });

    if (orphanedDepartments.length === 0) {
      console.log('✅ No orphaned departments found');
    } else {
      console.log(`❌ Found ${orphanedDepartments.length} orphaned departments:`);
      orphanedDepartments.forEach(dept => {
        console.log(`   • ${dept.name} (Tenant: ${dept.tenant.name}) - Campus: ${dept.campusId || 'NULL'}`);
      });
    }

    // 3. Check campus creation during onboarding
    console.log('\n3. 📈 CAMPUS CREATION ANALYSIS:');
    const mainCampuses = await prisma.campus.findMany({
      where: { isMain: true },
      include: {
        tenant: { select: { name: true, createdAt: true } },
        departments: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${mainCampuses.length} main campuses:`);
    mainCampuses.forEach(campus => {
      console.log(`   📍 ${campus.name} - Tenant: ${campus.tenant.name}`);
      console.log(`      Created: ${campus.createdAt}`);
      console.log(`      Tenant Created: ${campus.tenant.createdAt}`);
      console.log(`      Departments: ${campus.departments.length}`);
      campus.departments.forEach(dept => {
        console.log(`        • ${dept.name}`);
      });
    });

    // 4. Verify tenant onboarding workflow
    console.log('\n4. 🔧 TENANT ONBOARDING WORKFLOW CHECK:');
    const latestTenant = await prisma.tenant.findFirst({
      orderBy: { createdAt: 'desc' },
      include: {
        campuses: {
          select: {
            id: true,
            name: true,
            isMain: true,
            createdAt: true
          }
        },
        departments: {
          select: {
            id: true,
            name: true,
            code: true,
            campusId: true,
            createdAt: true
          }
        },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            campusId: true,
            createdAt: true
          }
        }
      }
    });

    if (latestTenant) {
      console.log(`Latest Tenant: ${latestTenant.name} (${latestTenant.createdAt})`);
      
      const mainCampus = latestTenant.campuses.find(c => c.isMain);
      const adminDept = latestTenant.departments.find(d => d.name === 'Administration');
      const systemAdmin = latestTenant.users.find(u => u.email.includes('admin'));

      console.log(`  Main Campus: ${mainCampus ? `✅ ${mainCampus.name}` : '❌ Missing'}`);
      console.log(`  Admin Dept: ${adminDept ? `✅ ${adminDept.name}` : '❌ Missing'}`);
      console.log(`  System Admin: ${systemAdmin ? `✅ ${systemAdmin.email}` : '❌ Missing'}`);
      
      if (adminDept && mainCampus) {
        const isLinked = adminDept.campusId === mainCampus.id;
        console.log(`  Campus-Dept Link: ${isLinked ? '✅ Correct' : '❌ Broken'}`);
        if (!isLinked) {
          console.log(`    Expected: ${mainCampus.id}, Got: ${adminDept.campusId}`);
        }
      }
    }

    console.log('\n✅ Analysis complete');

  } catch (error) {
    console.error('❌ Error analyzing relationships:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
analyzeTenantCampusDepartmentRelations();
