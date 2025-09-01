/**
 * Test campus service imports
 */

console.log('🧪 Testing campus service imports...');

try {
  // Test importing campus service
  const campusService = require('../src/services/campus.service.js');
  console.log('✅ Campus service imported successfully');
  console.log('📋 Campus service functions:', Object.keys(campusService));

  // Test importing campus controller
  const campusController = require('../src/controllers/campus.controller.js');
  console.log('✅ Campus controller imported successfully');
  console.log('📋 Campus controller functions:', Object.keys(campusController));

  // Test importing campus routes
  const campusRoutes = require('../src/routes/campusRoutes.js');
  console.log('✅ Campus routes imported successfully');

  console.log('\n🎉 All campus-related imports are working correctly!');

} catch (error) {
  console.error('❌ Import error:', error.message);
  console.error('Stack:', error.stack);
}
