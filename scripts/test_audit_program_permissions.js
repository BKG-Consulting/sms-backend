#!/usr/bin/env node

/**
 * Test Script for Audit Program Permission System
 * 
 * This script tests the permission system for audit program operations
 * by simulating different user roles and operations.
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

// Test configuration
const TEST_CONFIG = {
  tenantId: 'test-tenant-id',
  users: {
    systemAdmin: { email: 'system.admin@test.com', role: 'SYSTEM_ADMIN' },
    mr: { email: 'mr@test.com', role: 'MR' },
    principal: { email: 'principal@test.com', role: 'PRINCIPAL' },
    auditor: { email: 'auditor@test.com', role: 'AUDITOR' },
    staff: { email: 'staff@test.com', role: 'STAFF' }
  },
  testProgram: {
    title: 'Test Audit Program',
    objectives: 'Test objectives for permission testing'
  }
};

class PermissionTester {
  constructor() {
    this.tokens = {};
    this.testProgramId = null;
    this.results = [];
  }

  async log(message, data = {}) {
    console.log(`[${new Date().toISOString()}] ${message}`, data);
  }

  async createTestUsers() {
    this.log('Creating test users...');
    
    for (const [role, userData] of Object.entries(TEST_CONFIG.users)) {
      try {
        // Check if user exists
        let user = await prisma.user.findFirst({
          where: { email: userData.email }
        });

        if (!user) {
          // Create user
          user = await prisma.user.create({
            data: {
              email: userData.email,
              firstName: role.charAt(0).toUpperCase() + role.slice(1),
              lastName: 'TestUser',
              password: 'TestPassword123!',
              tenantId: TEST_CONFIG.tenantId,
              isActive: true
            }
          });
          this.log(`Created user: ${userData.email}`);
        }

        // Get or create role
        let roleRecord = await prisma.role.findFirst({
          where: { 
            name: userData.role,
            tenantId: TEST_CONFIG.tenantId
          }
        });

        if (!roleRecord) {
          roleRecord = await prisma.role.create({
            data: {
              name: userData.role,
              description: `Test ${userData.role} role`,
              tenantId: TEST_CONFIG.tenantId
            }
          });
          this.log(`Created role: ${userData.role}`);
        }

        // Assign role to user
        await prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId: roleRecord.id
            }
          },
          update: {},
          create: {
            userId: user.id,
            roleId: roleRecord.id
          }
        });

        this.log(`Assigned role ${userData.role} to user ${userData.email}`);
      } catch (error) {
        this.log(`Error creating user ${userData.email}:`, error.message);
      }
    }
  }

  async loginUsers() {
    this.log('Logging in test users...');
    
    for (const [role, userData] of Object.entries(TEST_CONFIG.users)) {
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
          email: userData.email,
          password: 'TestPassword123!'
        });

        this.tokens[role] = response.data.accessToken;
        this.log(`Logged in ${role}: ${userData.email}`);
      } catch (error) {
        this.log(`Login failed for ${role}:`, error.response?.data?.message || error.message);
      }
    }
  }

  async createTestProgram() {
    this.log('Creating test audit program...');
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/audit-programs`,
        TEST_CONFIG.testProgram,
        {
          headers: { Authorization: `Bearer ${this.tokens.mr}` }
        }
      );

      this.testProgramId = response.data.auditProgram.id;
      this.log(`Created test program: ${this.testProgramId}`);
    } catch (error) {
      this.log('Failed to create test program:', error.response?.data?.message || error.message);
    }
  }

  async testPermission(role, operation, expectedResult, description) {
    const token = this.tokens[role];
    if (!token) {
      this.log(`No token for role ${role}, skipping test`);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };
    let result = { success: false, status: null, message: '' };

    try {
      switch (operation) {
        case 'create':
          const createData = {
            title: `Test Program by ${role}`,
            objectives: `Test objectives by ${role}`
          };
          const createResponse = await axios.post(
            `${API_BASE_URL}/audit-programs`,
            createData,
            { headers }
          );
          result = { success: true, status: createResponse.status, message: 'Created successfully' };
          break;

        case 'read':
          const readResponse = await axios.get(
            `${API_BASE_URL}/audit-programs`,
            { headers }
          );
          result = { success: true, status: readResponse.status, message: 'Read successfully' };
          break;

        case 'update':
          if (!this.testProgramId) {
            result = { success: false, message: 'No test program to update' };
            break;
          }
          const updateResponse = await axios.put(
            `${API_BASE_URL}/audit-programs/${this.testProgramId}`,
            { title: `Updated by ${role}` },
            { headers }
          );
          result = { success: true, status: updateResponse.status, message: 'Updated successfully' };
          break;

        case 'commit':
          if (!this.testProgramId) {
            result = { success: false, message: 'No test program to commit' };
            break;
          }
          const commitResponse = await axios.patch(
            `${API_BASE_URL}/audit-programs/${this.testProgramId}/commit`,
            {},
            { headers }
          );
          result = { success: true, status: commitResponse.status, message: 'Committed successfully' };
          break;

        case 'approve':
          if (!this.testProgramId) {
            result = { success: false, message: 'No test program to approve' };
            break;
          }
          const approveResponse = await axios.patch(
            `${API_BASE_URL}/audit-programs/${this.testProgramId}/approve`,
            { approvalComment: `Approved by ${role}` },
            { headers }
          );
          result = { success: true, status: approveResponse.status, message: 'Approved successfully' };
          break;

        case 'delete':
          if (!this.testProgramId) {
            result = { success: false, message: 'No test program to delete' };
            break;
          }
          const deleteResponse = await axios.delete(
            `${API_BASE_URL}/audit-programs/${this.testProgramId}`,
            { headers }
          );
          result = { success: true, status: deleteResponse.status, message: 'Deleted successfully' };
          break;

        default:
          result = { success: false, message: `Unknown operation: ${operation}` };
      }
    } catch (error) {
      result = {
        success: false,
        status: error.response?.status,
        message: error.response?.data?.message || error.message
      };
    }

    const testResult = {
      role,
      operation,
      expectedResult,
      actualResult: result.success,
      status: result.status,
      message: result.message,
      description,
      passed: result.success === expectedResult
    };

    this.results.push(testResult);
    
    const status = testResult.passed ? '✅ PASS' : '❌ FAIL';
    this.log(`${status} ${role} ${operation}: ${result.message}`, {
      expected: expectedResult,
      actual: result.success,
      status: result.status
    });

    return testResult;
  }

  async runPermissionTests() {
    this.log('Running permission tests...');

    const tests = [
      // Create permissions
      { role: 'systemAdmin', operation: 'create', expected: true, description: 'System admin can create programs' },
      { role: 'mr', operation: 'create', expected: true, description: 'MR can create programs' },
      { role: 'principal', operation: 'create', expected: false, description: 'Principal cannot create programs' },
      { role: 'auditor', operation: 'create', expected: false, description: 'Auditor cannot create programs' },
      { role: 'staff', operation: 'create', expected: false, description: 'Staff cannot create programs' },

      // Read permissions
      { role: 'systemAdmin', operation: 'read', expected: true, description: 'System admin can read programs' },
      { role: 'mr', operation: 'read', expected: true, description: 'MR can read programs' },
      { role: 'principal', operation: 'read', expected: true, description: 'Principal can read programs' },
      { role: 'auditor', operation: 'read', expected: true, description: 'Auditor can read programs' },
      { role: 'staff', operation: 'read', expected: true, description: 'Staff can read programs' },

      // Update permissions (only owner or admin)
      { role: 'systemAdmin', operation: 'update', expected: true, description: 'System admin can update any program' },
      { role: 'mr', operation: 'update', expected: true, description: 'MR can update their own program' },
      { role: 'principal', operation: 'update', expected: false, description: 'Principal cannot update programs' },
      { role: 'auditor', operation: 'update', expected: false, description: 'Auditor cannot update programs' },
      { role: 'staff', operation: 'update', expected: false, description: 'Staff cannot update programs' },

      // Commit permissions (only owner or admin)
      { role: 'systemAdmin', operation: 'commit', expected: true, description: 'System admin can commit any program' },
      { role: 'mr', operation: 'commit', expected: true, description: 'MR can commit their own program' },
      { role: 'principal', operation: 'commit', expected: false, description: 'Principal cannot commit programs' },
      { role: 'auditor', operation: 'commit', expected: false, description: 'Auditor cannot commit programs' },
      { role: 'staff', operation: 'commit', expected: false, description: 'Staff cannot commit programs' },

      // Approve permissions (only admin or principal)
      { role: 'systemAdmin', operation: 'approve', expected: true, description: 'System admin can approve programs' },
      { role: 'mr', operation: 'approve', expected: false, description: 'MR cannot approve programs' },
      { role: 'principal', operation: 'approve', expected: true, description: 'Principal can approve programs' },
      { role: 'auditor', operation: 'approve', expected: false, description: 'Auditor cannot approve programs' },
      { role: 'staff', operation: 'approve', expected: false, description: 'Staff cannot approve programs' },

      // Delete permissions (only owner or admin)
      { role: 'systemAdmin', operation: 'delete', expected: true, description: 'System admin can delete any program' },
      { role: 'mr', operation: 'delete', expected: true, description: 'MR can delete their own program' },
      { role: 'principal', operation: 'delete', expected: false, description: 'Principal cannot delete programs' },
      { role: 'auditor', operation: 'delete', expected: false, description: 'Auditor cannot delete programs' },
      { role: 'staff', operation: 'delete', expected: false, description: 'Staff cannot delete programs' },
    ];

    for (const test of tests) {
      await this.testPermission(test.role, test.operation, test.expected, test.description);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async generateReport() {
    this.log('\n=== PERMISSION TEST REPORT ===');
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    console.log(`\n📊 Summary:`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    if (failedTests > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.results.filter(r => !r.passed).forEach(test => {
        console.log(`- ${test.role} ${test.operation}: ${test.message}`);
      });
    }

    console.log(`\n✅ All Tests Passed:`);
    this.results.filter(r => r.passed).forEach(test => {
      console.log(`- ${test.role} ${test.operation}: ${test.description}`);
    });

    return {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: (passedTests / totalTests) * 100,
      results: this.results
    };
  }

  async cleanup() {
    this.log('Cleaning up test data...');
    
    try {
      // Delete test program if it exists
      if (this.testProgramId) {
        await axios.delete(
          `${API_BASE_URL}/audit-programs/${this.testProgramId}`,
          { headers: { Authorization: `Bearer ${this.tokens.systemAdmin}` } }
        );
        this.log('Deleted test program');
      }

      // Clean up test users (optional - comment out if you want to keep them)
      // for (const [role, userData] of Object.entries(TEST_CONFIG.users)) {
      //   const user = await prisma.user.findFirst({
      //     where: { email: userData.email }
      //   });
      //   if (user) {
      //     await prisma.user.delete({ where: { id: user.id } });
      //     this.log(`Deleted test user: ${userData.email}`);
      //   }
      // }
    } catch (error) {
      this.log('Cleanup error:', error.message);
    }
  }

  async run() {
    try {
      this.log('🚀 Starting Audit Program Permission Tests');
      
      await this.createTestUsers();
      await this.loginUsers();
      await this.createTestProgram();
      await this.runPermissionTests();
      const report = await this.generateReport();
      
      this.log('✅ Permission tests completed');
      
      return report;
    } catch (error) {
      this.log('❌ Test execution failed:', error.message);
      throw error;
    } finally {
      await this.cleanup();
      await prisma.$disconnect();
    }
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  const tester = new PermissionTester();
  tester.run()
    .then(report => {
      console.log('\n🎉 Permission testing completed successfully!');
      process.exit(report.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('\n💥 Permission testing failed:', error);
      process.exit(1);
    });
}

module.exports = PermissionTester; 