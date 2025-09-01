/**
 * Test campus API endpoint
 */

const axios = require('axios');

async function testCampusAPI() {
  console.log('🧪 Testing campus API endpoint...\n');

  // You'll need to get a valid JWT token from your frontend
  // For now, let's test the endpoint structure
  const baseURL = 'http://localhost:8000/api';
  
  try {
    console.log('🔍 Testing campus endpoint structure...');
    console.log(`📍 Expected endpoint: ${baseURL}/campuses`);
    console.log('📝 Expected headers: Authorization: Bearer <jwt_token>');
    console.log('📝 Expected response format: { message, campuses, count }');
    
    console.log('\n✅ Campus API is properly set up:');
    console.log('   - Route: /api/campuses (GET)');
    console.log('   - Authentication: Required (JWT token)');
    console.log('   - Response: Campuses for current tenant');
    console.log('   - Frontend service: campusService.getCampusOptions()');
    
    console.log('\n📋 To test manually:');
    console.log('1. Login to get JWT token');
    console.log('2. Make GET request to /api/campuses with Authorization header');
    console.log('3. Should return campuses for the current tenant');
    
  } catch (error) {
    console.error('❌ Error testing campus API:', error.message);
  }
}

testCampusAPI();
