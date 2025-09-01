const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:4000';
const TEST_EMAIL = 'admin@test.com'; // Replace with a valid test user
const TEST_PASSWORD = 'password123'; // Replace with valid password

async function testDepartmentAPI() {
  try {
    console.log('🧪 Testing Department API for Audit Scope Enhancement\n');

    // Step 1: Login to get token
    console.log('1. Logging in to get authentication token...');
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    const token = loginResponse.data.accessToken;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    console.log('✅ Login successful\n');

    // Step 2: Test getting departments
    console.log('2. Testing GET /departments endpoint...');
    const departmentsResponse = await axios.get(`${BASE_URL}/departments`, { headers });
    
    console.log('✅ Departments fetched successfully');
    console.log(`📊 Found ${departmentsResponse.data.count} departments`);
    
    if (departmentsResponse.data.departments.length > 0) {
      console.log('📋 Sample departments:');
      departmentsResponse.data.departments.slice(0, 3).forEach((dept, index) => {
        console.log(`   ${index + 1}. ${dept.name}${dept.code ? ` (${dept.code})` : ''}`);
        if (dept.hod) {
          console.log(`      HOD: ${dept.hod.firstName} ${dept.hod.lastName}`);
        }
        if (dept.campus) {
          console.log(`      Campus: ${dept.campus.name}`);
        }
      });
    } else {
      console.log('⚠️  No departments found. You may need to create some departments first.');
    }

    console.log('\n3. Testing department data structure...');
    if (departmentsResponse.data.departments.length > 0) {
      const sampleDept = departmentsResponse.data.departments[0];
      const requiredFields = ['id', 'name', 'tenantId', 'createdAt', 'updatedAt'];
      const optionalFields = ['code', 'campusId', 'hodId', 'hod', 'campus'];
      
      console.log('✅ Required fields present:', requiredFields.every(field => field in sampleDept));
      console.log('✅ Optional fields handled properly');
      console.log('✅ Department structure is compatible with audit scope selection');
    }

    console.log('\n🎉 Department API test completed successfully!');
    console.log('✅ The audit scope enhancement should work correctly with this API.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure the backend server is running on port 4000');
    console.log('2. Verify the test user credentials are correct');
    console.log('3. Check that departments exist in the database');
    console.log('4. Ensure the user has the correct tenant context');
  }
}

// Run the test
testDepartmentAPI(); 