const { prisma } = require('../prisma/client');

async function diagnoseDepartmentHodDisplay() {
  try {
    console.log('=== DIAGNOSING DEPARTMENT HOD DISPLAY ISSUE ===\n');
    
    const tenantId = '40bbcd5e-2eb9-4c18-ad83-55a96db87003'; // Wilson's tenant
    
    // 1. Check what the backend API would return for departments
    console.log('1. SIMULATING: GET /api/departments (Backend Response)');
    
    const departments = await prisma.department.findMany({
      where: { tenantId },
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

    console.log(`✅ Found ${departments.length} departments for this tenant:`);
    
    departments.forEach((dept, index) => {
      console.log(`\n${index + 1}. Department: ${dept.name}`);
      console.log(`   ID: ${dept.id}`);
      console.log(`   Code: ${dept.code || 'No code'}`);
      console.log(`   HOD ID in DB: ${dept.hodId || 'NULL'}`);
      
      if (dept.hod) {
        console.log(`   ✅ HOD Data Available:`);
        console.log(`     - Name: ${dept.hod.firstName} ${dept.hod.lastName}`);
        console.log(`     - Email: ${dept.hod.email}`);
        console.log(`     - ID: ${dept.hod.id}`);
      } else {
        console.log(`   ❌ No HOD data returned (department.hod is null)`);
        if (dept.hodId) {
          console.log(`   🚨 MISMATCH: hodId exists (${dept.hodId}) but hod object is null!`);
        }
      }
    });

    // 2. Check if the relationship is working correctly
    console.log('\n2. RELATIONSHIP VERIFICATION:');
    
    // Check if Wilson is properly linked to Research Development
    const researchDept = departments.find(d => d.name.includes('Research'));
    if (researchDept) {
      console.log('\n📋 Research Development Department Analysis:');
      console.log(`   Department ID: ${researchDept.id}`);
      console.log(`   HOD ID in database: ${researchDept.hodId || 'NULL'}`);
      
      if (researchDept.hodId) {
        // Manually check if the user exists
        const hodUser = await prisma.user.findUnique({
          where: { id: researchDept.hodId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            verified: true,
            tenantId: true
          }
        });
        
        if (hodUser) {
          console.log(`   ✅ HOD User exists in database:`);
          console.log(`     - Name: ${hodUser.firstName} ${hodUser.lastName}`);
          console.log(`     - Email: ${hodUser.email}`);
          console.log(`     - Verified: ${hodUser.verified}`);
          console.log(`     - Tenant ID: ${hodUser.tenantId}`);
          console.log(`     - Same tenant?: ${hodUser.tenantId === tenantId ? 'YES ✅' : 'NO ❌'}`);
          
          if (!researchDept.hod) {
            console.log(`   🚨 RELATIONSHIP ISSUE: User exists but not returned in include`);
            console.log(`   🔍 This suggests a Prisma relationship problem`);
          }
        } else {
          console.log(`   ❌ HOD User with ID ${researchDept.hodId} does not exist!`);
          console.log(`   🚨 DATA INTEGRITY ISSUE: Department references non-existent user`);
        }
      }
    }

    // 3. Check all HOD assignments
    console.log('\n3. ALL HOD ASSIGNMENTS CHECK:');
    
    const allHodAssignments = await prisma.department.findMany({
      where: { 
        tenantId,
        hodId: { not: null }
      },
      include: {
        hod: true
      }
    });
    
    console.log(`Found ${allHodAssignments.length} departments with HOD assignments:`);
    
    allHodAssignments.forEach(dept => {
      console.log(`\n   Department: ${dept.name}`);
      console.log(`   HOD ID: ${dept.hodId}`);
      console.log(`   HOD object returned: ${dept.hod ? 'YES ✅' : 'NO ❌'}`);
      if (dept.hod) {
        console.log(`   HOD Name: ${dept.hod.firstName} ${dept.hod.lastName}`);
      }
    });

    // 4. Frontend expectation vs reality
    console.log('\n4. FRONTEND COMPONENT ANALYSIS:');
    console.log('The frontend OptimizedDepartmentsTab.tsx expects:');
    console.log('   - department.hod object with firstName and lastName');
    console.log('   - If department.hod exists, show name');
    console.log('   - If department.hod is null/undefined, show "assign" button');
    console.log('');
    console.log('Current backend response structure:');
    departments.forEach(dept => {
      console.log(`   ${dept.name}: department.hod = ${dept.hod ? 'EXISTS' : 'NULL'}`);
    });

    // 5. Diagnostic summary
    console.log('\n5. DIAGNOSTIC SUMMARY:');
    
    const deptWithHod = departments.filter(d => d.hod);
    const deptWithHodId = departments.filter(d => d.hodId);
    const deptWithMismatch = departments.filter(d => d.hodId && !d.hod);
    
    console.log(`   Total departments: ${departments.length}`);
    console.log(`   Departments with hodId: ${deptWithHodId.length}`);
    console.log(`   Departments with hod object: ${deptWithHod.length}`);
    console.log(`   Departments with mismatch (hodId but no hod): ${deptWithMismatch.length}`);
    
    if (deptWithMismatch.length > 0) {
      console.log(`\n   🚨 ISSUE IDENTIFIED: ${deptWithMismatch.length} departments have hodId but no hod object`);
      console.log(`   This explains why frontend shows "assign" for all departments`);
      console.log(`   
   SOLUTION NEEDED:
   1. Fix the Prisma relationship/query
   2. Or ensure hodId references valid users
   3. Or update frontend to handle this case`);
    } else if (deptWithHod.length === 0) {
      console.log(`\n   🚨 ISSUE: No departments have HOD objects returned`);
      console.log(`   This explains why frontend shows "assign" for all departments`);
    } else {
      console.log(`\n   ✅ HOD data is being returned correctly`);
      console.log(`   The issue might be in frontend data handling or caching`);
    }

  } catch (error) {
    console.error('Error during diagnosis:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseDepartmentHodDisplay();
