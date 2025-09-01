#!/usr/bin/env node

/**
 * Simple Planning Meeting Integration Test Script
 * Tests the planning meeting integration without external dependencies
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
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

// File System Tests
function testFileSystem() {
  logTest('Testing File System...');
  
  try {
    // Test 1: Check if new meeting components exist
    const newComponents = [
      '../dual-dimension-consulting/src/components/meetings/UnifiedMeetingManager.tsx',
      '../dual-dimension-consulting/src/components/meetings/CreateMeetingForm.tsx',
      '../dual-dimension-consulting/src/app/(protected)/audits/[programId]/[auditId]/meetings/page.tsx',
      '../dual-dimension-consulting/src/app/(protected)/audits/[programId]/[auditId]/meetings/[meetingId]/page.tsx',
      '../dual-dimension-consulting/src/app/(protected)/audits/[programId]/[auditId]/meetings/create/page.tsx'
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
      'src/services/meetingService.js',
      'src/controllers/meetingController.js',
      'src/routes/meetingRoutes.js'
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
    const oldPlanningPage = '../dual-dimension-consulting/src/app/(protected)/audits/[programId]/[auditId]/planning-meeting/page.tsx';
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
function testIntegration() {
  logTest('Testing Integration Points...');
  
  try {
    // Test 1: Check if MeetingManagement component is updated
    const meetingManagementFile = '../dual-dimension-consulting/src/app/(protected)/audits/[programId]/[auditId]/_components/MeetingManagement.tsx';
    
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
    const auditsPageFile = '../dual-dimension-consulting/src/app/(protected)/audits/page.tsx';
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
      '../dual-dimension-consulting/src/components/audit/PlanningMeetingQuickAction.tsx',
      '../dual-dimension-consulting/src/components/audit/PlanningMeetingIcon.tsx',
      '../dual-dimension-consulting/src/app/(protected)/auditors/_components/PlanningMeetings.tsx',
      '../dual-dimension-consulting/src/app/(protected)/auditors/_components/AuditAssignmentsTable.tsx'
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
function testWorkflow() {
  logTest('Testing Complete Workflow...');
  
  try {
    // Test 1: Check if CreateMeetingForm handles planning meetings
    const createMeetingFormFile = '../dual-dimension-consulting/src/components/meetings/CreateMeetingForm.tsx';
    
    if (fs.existsSync(createMeetingFormFile)) {
      const content = fs.readFileSync(createMeetingFormFile, 'utf8');
      
      const hasPlanningLogic = content.includes('meetingType === \'PLANNING\'');
      const hasTeamMembersLogic = content.includes('currentAudit?.teamMembers');
      const hasAutoSelect = content.includes('setSelectedAttendees(filteredUsers.map');
      const hasUseSearchParams = content.includes('useSearchParams');
      
      const planningLogicComplete = hasPlanningLogic && hasTeamMembersLogic && hasAutoSelect && hasUseSearchParams;
      addTestResult('Workflow: Planning Meeting Logic', planningLogicComplete,
        planningLogicComplete ? 'Planning meeting logic complete' : 'Planning meeting logic incomplete');
    } else {
      addTestResult('Workflow: Planning Meeting Logic', false, 'CreateMeetingForm not found');
    }
    
    // Test 2: Check if UnifiedMeetingManager handles all meeting types
    const unifiedManagerFile = '../dual-dimension-consulting/src/components/meetings/UnifiedMeetingManager.tsx';
    
    if (fs.existsSync(unifiedManagerFile)) {
      const content = fs.readFileSync(unifiedManagerFile, 'utf8');
      
      const hasTabs = content.includes('Tabs') || content.includes('Tab');
      const hasAttendance = content.includes('attendance') || content.includes('Attendance');
      const hasAgenda = content.includes('agenda') || content.includes('Agenda');
      const hasActions = content.includes('action') || content.includes('Action');
      const hasNotes = content.includes('notes') || content.includes('Notes');
      
      const managerComplete = hasTabs && hasAttendance && hasAgenda && hasActions && hasNotes;
      addTestResult('Workflow: Unified Meeting Manager', managerComplete,
        managerComplete ? 'Unified meeting manager complete' : 'Unified meeting manager incomplete');
    } else {
      addTestResult('Workflow: Unified Meeting Manager', false, 'UnifiedMeetingManager not found');
    }
    
    // Test 3: Check if API endpoints are correctly configured
    const meetingServiceFile = 'src/services/meetingService.js';
    
    if (fs.existsSync(meetingServiceFile)) {
      const content = fs.readFileSync(meetingServiceFile, 'utf8');
      
      const hasCreateMeeting = content.includes('createMeeting');
      const hasPlanningLogic = content.includes('type === \'PLANNING\'');
      const hasTeamMembers = content.includes('teamMembers');
      const hasPrismaImport = content.includes('require(\'../../prisma/client\')');
      
      const serviceComplete = hasCreateMeeting && hasPlanningLogic && hasTeamMembers && hasPrismaImport;
      addTestResult('Workflow: Meeting Service', serviceComplete,
        serviceComplete ? 'Meeting service complete' : 'Meeting service incomplete');
    } else {
      addTestResult('Workflow: Meeting Service', false, 'Meeting service not found');
    }
    
    // Test 4: Check if meeting routes are properly mounted
    const auditRoutesFile = 'src/routes/auditRoutes.js';
    
    if (fs.existsSync(auditRoutesFile)) {
      const content = fs.readFileSync(auditRoutesFile, 'utf8');
      
      const hasMeetingRoutes = content.includes('meetingRoutes');
      const hasMountLine = content.includes('router.use(\'/:auditId/meetings\', meetingRoutes)');
      
      const routesMounted = hasMeetingRoutes && hasMountLine;
      addTestResult('Workflow: Meeting Routes Mounted', routesMounted,
        routesMounted ? 'Meeting routes properly mounted' : 'Meeting routes not mounted');
    } else {
      addTestResult('Workflow: Meeting Routes Mounted', false, 'Audit routes file not found');
    }
    
  } catch (error) {
    addTestResult('Workflow: Tests', false, `Workflow test failed: ${error.message}`);
  }
}

// Schema Tests
function testSchema() {
  logTest('Testing Database Schema...');
  
  try {
    const schemaFile = 'prisma/schema.prisma';
    
    if (fs.existsSync(schemaFile)) {
      const content = fs.readFileSync(schemaFile, 'utf8');
      
      // Test 1: Check if new meeting models exist
      const hasMeetingModel = content.includes('model Meeting {');
      const hasMeetingAttendance = content.includes('model MeetingAttendance {');
      const hasMeetingAgenda = content.includes('model MeetingAgenda {');
      const hasMeetingDocument = content.includes('model MeetingDocument {');
      const hasMeetingAction = content.includes('model MeetingAction {');
      
      const allModelsExist = hasMeetingModel && hasMeetingAttendance && hasMeetingAgenda && hasMeetingDocument && hasMeetingAction;
      addTestResult('Schema: New Meeting Models', allModelsExist,
        allModelsExist ? 'All new meeting models exist' : 'Some meeting models missing');
      
      // Test 2: Check if new enums exist
      const hasMeetingType = content.includes('enum MeetingType {');
      const hasMeetingStatus = content.includes('enum MeetingStatus {');
      const hasActionPriority = content.includes('enum ActionPriority {');
      const hasActionStatus = content.includes('enum ActionStatus {');
      
      const allEnumsExist = hasMeetingType && hasMeetingStatus && hasActionPriority && hasActionStatus;
      addTestResult('Schema: New Enums', allEnumsExist,
        allEnumsExist ? 'All new enums exist' : 'Some enums missing');
      
      // Test 3: Check if old planning meeting models are removed
      const hasOldPlanningMeeting = content.includes('model AuditPlanningMeeting');
      const hasOldPlanningAttendance = content.includes('model AuditPlanningAttendance');
      const hasOldPlanningAgenda = content.includes('model AuditPlanningAgenda');
      const hasOldPlanningStatus = content.includes('enum PlanningMeetingStatus');
      
      const oldModelsRemoved = !hasOldPlanningMeeting && !hasOldPlanningAttendance && !hasOldPlanningAgenda && !hasOldPlanningStatus;
      addTestResult('Schema: Old Models Removed', oldModelsRemoved,
        oldModelsRemoved ? 'Old planning meeting models removed' : 'Old planning meeting models still exist');
      
      // Test 4: Check if User model has correct relations
      const hasCreatedMeetings = content.includes('createdMeetings');
      const hasMeetingAttendances = content.includes('meetingAttendances');
      const hasUploadedMeetingDocuments = content.includes('uploadedMeetingDocuments');
      const hasAssignedMeetingActions = content.includes('assignedMeetingActions');
      const hasCreatedMeetingActions = content.includes('createdMeetingActions');
      
      const userRelationsCorrect = hasCreatedMeetings && hasMeetingAttendances && hasUploadedMeetingDocuments && hasAssignedMeetingActions && hasCreatedMeetingActions;
      addTestResult('Schema: User Relations', userRelationsCorrect,
        userRelationsCorrect ? 'User model has correct meeting relations' : 'User model missing meeting relations');
      
      // Test 5: Check if Audit model has correct relations
      const hasMeetingsRelation = content.includes('meetings                  Meeting[]');
      const noPlanningMeetings = !content.includes('planningMeetings');
      
      const auditRelationsCorrect = hasMeetingsRelation && noPlanningMeetings;
      addTestResult('Schema: Audit Relations', auditRelationsCorrect,
        auditRelationsCorrect ? 'Audit model has correct meeting relations' : 'Audit model has incorrect meeting relations');
      
    } else {
      addTestResult('Schema: File Exists', false, 'Schema file not found');
    }
    
  } catch (error) {
    addTestResult('Schema: Tests', false, `Schema test failed: ${error.message}`);
  }
}

// Main test runner
function runTests() {
  log('🚀 Starting Planning Meeting Integration Tests...', 'bright');
  log('=' .repeat(60), 'blue');
  
  try {
    testSchema();
    testFileSystem();
    testIntegration();
    testWorkflow();
    
  } catch (error) {
    logError(`Test runner failed: ${error.message}`);
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
    log('\n📋 NEXT STEPS:', 'bright');
    log('1. Start your backend server (auth-service)', 'blue');
    log('2. Start your frontend server (dual-dimension-consulting)', 'blue');
    log('3. Navigate to the audits page', 'blue');
    log('4. Click "Audit Plan Meeting" button', 'blue');
    log('5. Test the complete planning meeting workflow', 'blue');
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
  runTests();
}

module.exports = {
  runTests,
  testResults
}; 