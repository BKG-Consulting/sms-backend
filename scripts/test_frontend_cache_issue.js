const { prisma } = require('../prisma/client');

async function testFrontendCacheIssue() {
  try {
    console.log('=== TESTING FRONTEND CACHE REFRESH ISSUE ===\n');
    
    // 1. Check actual current state in database
    console.log('1. CURRENT DATABASE STATE:');
    
    const researchDept = await prisma.department.findFirst({
      where: { 
        name: { contains: 'Research' },
        tenantId: '40bbcd5e-2eb9-4c18-ad83-55a96db87003'
      },
      include: {
        hod: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    if (researchDept) {
      console.log('Research Development Department:');
      console.log(`  HOD ID: ${researchDept.hodId || 'NULL'}`);
      console.log(`  HOD Object: ${researchDept.hod ? JSON.stringify(researchDept.hod) : 'NULL'}`);
    } else {
      console.log('❌ Research Development department not found');
    }

    // 2. Simulate the exact API call the frontend makes
    console.log('\n2. SIMULATING FRONTEND API CALL:');
    
    const departments = await prisma.department.findMany({
      where: { tenantId: '40bbcd5e-2eb9-4c18-ad83-55a96db87003' },
      include: {
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        campus: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    const formattedResponse = {
      departments: departments.map(d => ({ ...d, isActive: true }))
    };

    console.log('API Response (as frontend would receive):');
    formattedResponse.departments.forEach(dept => {
      console.log(`\n  ${dept.name}:`);
      console.log(`    hodId: ${dept.hodId || 'null'}`);
      console.log(`    hod: ${dept.hod ? JSON.stringify(dept.hod, null, 6) : 'null'}`);
    });

    // 3. Check if any departments have HODs
    const deptsWithHods = formattedResponse.departments.filter(d => d.hod);
    console.log(`\n3. SUMMARY:`);
    console.log(`   Total departments: ${formattedResponse.departments.length}`);
    console.log(`   Departments with HODs: ${deptsWithHods.length}`);
    
    if (deptsWithHods.length > 0) {
      console.log('\n✅ HOD data is available in API response');
      console.log('If frontend still shows "assign" for all departments, the issue is:');
      console.log('  1. Frontend cache is stale and not refreshing');
      console.log('  2. Frontend data transformation is incorrect');
      console.log('  3. Frontend component is not checking the right property');
      console.log('\n🔧 SOLUTIONS:');
      console.log('  1. Force cache refresh in frontend');
      console.log('  2. Check browser developer tools for network requests');
      console.log('  3. Check browser console for the debug logs we added');
    } else {
      console.log('\n❌ No HOD data in API response');
      console.log('This confirms the backend issue');
    }

    // 4. Wilson specific check
    console.log('\n4. WILSON SPECIFIC CHECK:');
    const wilson = await prisma.user.findUnique({
      where: { id: 'adace105-774b-4662-893b-e018cfd3b89b' },
      select: { id: true, firstName: true, lastName: true, email: true, verified: true }
    });

    if (wilson) {
      console.log('Wilson User Data:');
      console.log(`  ID: ${wilson.id}`);
      console.log(`  Name: ${wilson.firstName} ${wilson.lastName}`);
      console.log(`  Email: ${wilson.email}`);
      console.log(`  Verified: ${wilson.verified}`);
      
      // Check if Wilson is HOD of Research Development
      const isWilsonHod = researchDept && researchDept.hodId === wilson.id;
      console.log(`  Is HOD of Research Development: ${isWilsonHod ? 'YES ✅' : 'NO ❌'}`);
    }

    console.log('\n5. NEXT STEPS:');
    console.log('1. Open browser developer tools');
    console.log('2. Go to Institution Management > Departments tab');
    console.log('3. Check Console for "FRONTEND DEBUG: Departments API response"');
    console.log('4. Check Network tab for GET /api/departments call');
    console.log('5. If cache is the issue, force refresh or clear cache');

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFrontendCacheIssue();
