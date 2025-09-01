/**
 * TEST RUNNER - Execute Tenant Isolation Tests
 */

const TenantIsolationTestSuite = require('./tenant_isolation_test_suite');

async function runTests() {
  console.log('🚀 Starting Tenant Isolation & Data Integrity Tests...\n');
  
  const testSuite = new TenantIsolationTestSuite();
  
  try {
    const results = await testSuite.runAllTests();
    
    // Exit with appropriate code
    process.exit(results.failed === 0 ? 0 : 1);
    
  } catch (error) {
    console.error('💥 Test suite failed to run:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests };
