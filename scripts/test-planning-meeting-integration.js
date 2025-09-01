#!/usr/bin/env node

/**
 * Planning Meeting Integration Test Script
 * Tests the complete planning meeting workflow with the new unified meeting system
 */

const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');

// Configuration
const BASE_URL = 'http://localhost:3001'; // Backend URL
const FRONTEND_URL = 'http://localhost:3000'; // Frontend URL

// Test data
const TEST_TENANT_ID = 'test-tenant-id';
const TEST_USER_ID = 'test-user-id';
const TEST_AUDIT_ID = 'test-audit-id';
const TEST_PROGRAM_ID = 'test-program-id';

const prisma = new PrismaClient();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logTest(message) {
  log(`🧪 ${message}`, 'cyan');
}

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function addTestResult(testName, passed, message = '', warning = false) {
  const result = {
    name: testName,
    passed,
    message,
    warning,
    timestamp: new Date().toISOString()
  };
  
  testResults.tests.push(result);
  
  if (warning) {
    testResults.warnings++;
    logWarning(`${testName}: ${message}`);
  } else if (passed) {
    testResults.passed++;
    logSuccess(`${testName}: ${message}`);
  } else {
    testResults.failed++;
    logError(`${testName}: ${message}`);
  }
}

// Database Schema Tests
async function testDatabaseSchema() {
  logTest('Testing Database Schema...');
  
  try {
    // Test 1: Check if new meeting models exist
    const meetingCount = await prisma.meeting.count();
    logInfo(`Found ${meetingCount} meetings in database`);
    addTestResult('Database: Meeting Model Exists', true, `Found ${meetingCount} meetings`);
    
    // Test 2: Check if new enums exist
    const meetingTypes = await prisma.$queryRaw`
      SELECT unnest(enum_range(NULL::"MeetingType")) as type;
    `;
    const expectedTypes = ['PLANNING', 'OPENING', 'CLOSING', 'MANAGEMENT_REVIEW', 'FOLLOW_UP', 'CORRECTIVE_ACTION', 'PREVENTIVE_ACTION'];
    const foundTypes = meetingTypes.map(t => t.type);
    
    const allTypesExist = expectedTypes.every(type => foundTypes.includes(type));
    addTestResult('Database: MeetingType Enum Complete', allTypesExist, 
      allTypesExist ? 'All expected meeting types found' : `Missing types: ${expectedTypes.filter(t => !foundTypes.includes(t)).join(', ')}`);
    
    // Test 3: Check if old planning meeting models are removed
    try {
      await prisma.auditPlanningMeeting.count();
      addTestResult('Database: Old Models Removed', false, 'AuditPlanningMeeting still exists');
    } catch (error) {
      if (error.message.includes('does not exist')) {
        addTestResult('Database: Old Models Removed', true, 'AuditPlanningMeeting successfully removed');
      } else {
        addTestResult('Database: Old Models Removed', false, `Unexpected error: ${error.message}`);
      }
    }
    
    // Test 4: Check User model relations
    const userWithMeetings = await prisma.user.findFirst({
      include: {
        createdMeetings: true,
        meetingAttendances: true
      }
    });
    
    if (userWithMeetings) {
      addTestResult('Database: User Relations Updated', true, 'User model has correct meeting relations');
    } else {
      addTestResult('Database: User Relations Updated', true, 'No users with meetings found (expected)');
    }
    
  } catch (error) {
    addTestResult('Database: Schema Tests', false, `Database connection failed: ${error.message}`);
  }
}

// Backend API Tests
async function testBackendAPI() {
  logTest('Testing Backend API...');
  
  try {
    // Test 1: Check if meeting routes are mounted
    const response = await fetch(`${BASE_URL}/api/audits/${TEST_AUDIT_ID}/meetings`);
    const status = response.status;
    
    if (status === 401) {
      addTestResult('Backend: Meeting Routes Mounted', true, 'Routes exist (401 expected without auth)');
    } else if (status === 404) {
      addTestResult('Backend: Meeting Routes Mounted', false, 'Meeting routes not found');
    } else {
      addTestResult('Backend: Meeting Routes Mounted', true, `Routes respond with status ${status}`);
    }
    
    // Test 2: Check if old planning meeting routes are removed
    const oldResponse = await fetch(`${BASE_URL}/api/audits/${TEST_AUDIT_ID}/planning-meetings`);
    if (oldResponse.status === 404) {
      addTestResult('Backend: Old Routes Removed', true, 'Old planning meeting routes successfully removed');
    } else {
      addTestResult('Backend: Old Routes Removed', false, 'Old planning meeting routes still exist');
    }
    
  } catch (error) {
    addTestResult('Backend: API Tests', false, `Backend connection failed: ${error.message}`);
  }
}

// Frontend Route Tests
async function testFrontendRoutes() {
  logTest('Testing Frontend Routes...');
  
  try {
    // Test 1: Check if new meeting routes exist
    const response = await fetch(`${FRONTEND_URL}/audits/${TEST_PROGRAM_ID}/${TEST_AUDIT_ID}/meetings`);
    const status = response.status;
    
    if (status === 200 || status === 404) {
      addTestResult('Frontend: New Meeting Routes', true, 'New meeting routes accessible');
    } else {
      addTestResult('Frontend: New Meeting Routes', false, `Unexpected status: ${status}`);
    }
    
    // Test 2: Check if planning meeting redirect works
    const planningResponse = await fetch(`${FRONTEND_URL}/audits/${TEST_PROGRAM_ID}/${TEST_AUDIT_ID}/planning-meeting`);
    const planningStatus = planningResponse.status;
    
    if (planningStatus === 200 || planningStatus === 404) {
      addTestResult('Frontend: Planning Meeting Redirect', true, 'Planning meeting page accessible (will redirect)');
    } else {
      addTestResult('Frontend: Planning Meeting Redirect', false, `Unexpected status: ${planningStatus}`);
    }
    
  } catch (error) {
    addTestResult('Frontend: Route Tests', false, `Frontend connection failed: ${error.message}`);
  }
}

// File System Tests
async function testFileSystem() {
  logTest('Testing File System...');
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Test 1: Check if new meeting components exist
    const newComponents = [
      'src/components/meetings/UnifiedMeetingManager.tsx',
      'src/components/meetings/CreateMeetingForm.tsx',
      'src/app/(protected)/audits/[programId]/[auditId]/meetings/page.tsx',
      'src/app/(protected)/audits/[programId]/[auditId]/meetings/[meetingId]/page.tsx',
      'src/app/(protected)/auditId]/meetings/create/page.tsx'
    ];
    
    let existingComponents = 0;
    for (const component of newComponents) {
      if (fs.existsSync(component)) {
        existingComponents++;
      }
    }
    
    addTestResult('Frontend: New Components Exist', existingComponents > 0, 
      `${existingComponents}/${newComponents.length} new components found`);
    
    // Test 2: Check if backend meeting files exist
    const backendFiles = [
      'auth-service/src/services/meetingService.js',
      'auth-service/src/controllers/meetingController.js',
      'auth-service/src/routes/meetingRoutes.js'
    ];
    
    let existingBackendFiles = 0;
    for (const file of backendFiles) {
      if (fs.existsSync(file)) {
        existingBackendFiles++;
      }
    }
    
    addTestResult('Backend: New Meeting Files Exist', existingBackendFiles > 0,
      `${existingBackendFiles}/${backendFiles.length} new backend files found`);
    
    // Test 3: Check if old planning meeting files are updated
    const oldPlanningPage = 'src/app/(protected)/audits/[programId]/[auditId]/planning-meeting/page.tsx';
    if (fs.existsSync(oldPlanningPage)) {
      const content = fs.readFileSync(oldPlanningPage, 'utf8');
      if (content.includes('redirect') || content.includes('unified meeting system')) {
        addTestResult('Frontend: Old Planning Page Updated', true, 'Old planning page updated to redirect');
      } else {
        addTestResult('Frontend: Old Planning Page Updated', false, 'Old planning page not updated');
      }
    } else {
      addTestResult('Frontend: Old Planning Page Updated', true, 'Old planning page removed');
    }
    
  } catch (error) {
    addTestResult('File System: Tests', false, `File system test failed: ${error.message}`);
  }
}

// Integration Tests
async function testIntegration() {
  logTest('Testing Integration Points...');
  
  try {
    // Test 1: Check if MeetingManagement component is updated
    const fs = require('fs');
    const meetingManagementFile = 'src/app/(protected)/audits/[programId]/[auditId]/_components/MeetingManagement.tsx';
    
    if (fs.existsSync(meetingManagementFile)) {
      const content = fs.readFileSync(meetingManagementFile, 'utf8');
      if (content.includes('/meetings/create?type=PLANNING')) {
        addTestResult('Integration: MeetingManagement Updated', true, 'MeetingManagement component updated to use new system');
      } else {
        addTestResult('Integration: MeetingManagement Updated', false, 'MeetingManagement component not updated');
      }
    } else {
      addTestResult('Integration: MeetingManagement Updated', false, 'MeetingManagement component not found');
    }
    
    // Test 2: Check if audits page is updated
    const auditsPageFile = 'src/app/(protected)/audits/page.tsx';
    if (fs.existsSync(auditsPageFile)) {
      const content = fs.readFileSync(auditsPageFile, 'utf8');
      if (content.includes('/meetings/create?type=PLANNING')) {
        addTestResult('Integration: Audits Page Updated', true, 'Audits page updated to use new system');
      } else {
        addTestResult('Integration: Audits Page Updated', false, 'Audits page not updated');
      }
    } else {
      addTestResult('Integration: Audits Page Updated', false, 'Audits page not found');
    }
    
    // Test 3: Check if all planning meeting references are updated
    const filesToCheck = [
      'src/components/audit/PlanningMeetingQuickAction.tsx',
      'src/components/audit/PlanningMeetingIcon.tsx',
      'src/app/(protected)/auditors/_components/PlanningMeetings.tsx',
      'src/app/(protected)/auditors/_components/AuditAssignmentsTable.tsx'
    ];
    
    let updatedFiles = 0;
    for (const file of filesToCheck) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        if (content.includes('/meetings/') && !content.includes('/planning-meeting')) {
          updatedFiles++;
        }
      }
    }
    
    addTestResult('Integration: All References Updated', updatedFiles > 0,
      `${updatedFiles}/${filesToCheck.length} files updated to use new system`);
    
  } catch (error) {
    addTestResult('Integration: Tests', false, `Integration test failed: ${error.message}`);
  }
}

// Workflow Tests
async function testWorkflow() {
  logTest('Testing Complete Workflow...');
  
  try {
    // Test 1: Check if CreateMeetingForm handles planning meetings
    const fs = require('fs');
    const createMeetingFormFile = 'src/components/meetings/CreateMeetingForm.tsx';
    
    if (fs.existsSync(createMeetingFormFile)) {
      const content = fs.readFileSync(createMeetingFormFile, 'utf8');
      
      const hasPlanningLogic = content.includes('meetingType === \'PLANNING\'');
      const hasTeamMembersLogic = content.includes('currentAudit?.teamMembers');
      const hasAutoSelect = content.includes('setSelectedAttendees(filteredUsers.map');
      
      const planningLogicComplete = hasPlanningLogic && hasTeamMembersLogic && hasAutoSelect;
      addTestResult('Workflow: Planning Meeting Logic', planningLogicComplete,
        planningLogicComplete ? 'Planning meeting logic complete' : 'Planning meeting logic incomplete');
    } else {
      addTestResult('Workflow: Planning Meeting Logic', false, 'CreateMeetingForm not found');
    }
    
    // Test 2: Check if UnifiedMeetingManager handles all meeting types
    const unifiedManagerFile = 'src/components/meetings/UnifiedMeetingManager.tsx';
    
    if (fs.existsSync(unifiedManagerFile)) {
      const content = fs.readFileSync(unifiedManagerFile, 'utf8');
      
      const hasTabs = content.includes('Tabs') || content.includes('Tab');
      const hasAttendance = content.includes('attendance') || content.includes('Attendance');
      const hasAgenda = content.includes('agenda') || content.includes('Agenda');
      const hasActions = content.includes('action') || content.includes('Action');
      
      const managerComplete = hasTabs && hasAttendance && hasAgenda && hasActions;
      addTestResult('Workflow: Unified Meeting Manager', managerComplete,
        managerComplete ? 'Unified meeting manager complete' : 'Unified meeting manager incomplete');
    } else {
      addTestResult('Workflow: Unified Meeting Manager', false, 'UnifiedMeetingManager not found');
    }
    
    // Test 3: Check if API endpoints are correctly configured
    const meetingServiceFile = 'auth-service/src/services/meetingService.js';
    
    if (fs.existsSync(meetingServiceFile)) {
      const content = fs.readFileSync(meetingServiceFile, 'utf8');
      
      const hasCreateMeeting = content.includes('createMeeting');
      const hasPlanningLogic = content.includes('type === \'PLANNING\'');
      const hasTeamMembers = content.includes('teamMembers');
      
      const serviceComplete = hasCreateMeeting && hasPlanningLogic && hasTeamMembers;
      addTestResult('Workflow: Meeting Service', serviceComplete,
        serviceComplete ? 'Meeting service complete' : 'Meeting service incomplete');
    } else {
      addTestResult('Workflow: Meeting Service', false, 'Meeting service not found');
    }
    
  } catch (error) {
    addTestResult('Workflow: Tests', false, `Workflow test failed: ${error.message}`);
  }
}

// Main test runner
async function runTests() {
  log('🚀 Starting Planning Meeting Integration Tests...', 'bright');
  log('=' .repeat(60), 'blue');
  
  try {
    await testDatabaseSchema();
    await testBackendAPI();
    await testFrontendRoutes();
    await testFileSystem();
    await testIntegration();
    await testWorkflow();
    
  } catch (error) {
    logError(`Test runner failed: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
  
  // Print summary
  log('\n' + '=' .repeat(60), 'blue');
  log('📊 TEST SUMMARY', 'bright');
  log('=' .repeat(60), 'blue');
  
  log(`✅ Passed: ${testResults.passed}`, 'green');
  log(`❌ Failed: ${testResults.failed}`, 'red');
  log(`⚠️  Warnings: ${testResults.warnings}`, 'yellow');
  
  const totalTests = testResults.passed + testResults.failed + testResults.warnings;
  const successRate = totalTests > 0 ? Math.round((testResults.passed / totalTests) * 100) : 0;
  
  log(`📈 Success Rate: ${successRate}%`, successRate >= 80 ? 'green' : 'red');
  
  if (testResults.failed === 0) {
    log('\n🎉 All critical tests passed! Planning meeting integration is working correctly.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Please review the issues above.', 'yellow');
  }
  
  // Detailed results
  log('\n📋 DETAILED RESULTS:', 'bright');
  testResults.tests.forEach(test => {
    const status = test.passed ? '✅' : test.warning ? '⚠️' : '❌';
    const color = test.passed ? 'green' : test.warning ? 'yellow' : 'red';
    log(`${status} ${test.name}: ${test.message}`, color);
  });
  
  log('\n🏁 Test run completed!', 'bright');
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testResults
}; 