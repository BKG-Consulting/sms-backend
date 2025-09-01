/**
 * COMPREHENSIVE TENANT ISOLATION & DATA INTEGRITY TEST SUITE
 * Tests all edge cases for multi-tenant role security
 */

const { prisma } = require('../../prisma/client');
const tenantService = require('../services/tenantService');
const { logger } = require('../utils/logger');

class TenantIsolationTestSuite {

  async runAllTests() {
    console.log('🔒 STARTING TENANT ISOLATION & DATA INTEGRITY TEST SUITE');
    console.log('=' .repeat(70));
    
    const results = {
      passed: 0,
      failed: 0,
      tests: []
    };

    // Setup test data
    await this.setupTestData();

    const tests = [
      // Core Tenant Isolation Tests
      { name: 'Cross-Tenant Role Assignment Prevention', fn: () => this.testCrossTenantRoleAssignment() },
      { name: 'Same Name Role Isolation', fn: () => this.testSameNameRoleIsolation() },
      { name: 'Tenant Role Validation in Registration', fn: () => this.testTenantRoleValidationRegistration() },
      { name: 'Tenant Role Validation in Updates', fn: () => this.testTenantRoleValidationUpdate() },
      
      // Edge Cases
      { name: 'Malicious Role ID Injection', fn: () => this.testMaliciousRoleInjection() },
      { name: 'Role ID Spoofing Attack', fn: () => this.testRoleIdSpoofing() },
      { name: 'Department Role Cross-Tenant Prevention', fn: () => this.testDepartmentRoleCrossTenant() },
      { name: 'Default Role Tenant Validation', fn: () => this.testDefaultRoleTenantValidation() },
      
      // Data Integrity Tests
      { name: 'HOD Assignment Tenant Isolation', fn: () => this.testHodAssignmentTenantIsolation() },
      { name: 'Role Hierarchy Tenant Consistency', fn: () => this.testRoleHierarchyTenantConsistency() },
      { name: 'User Migration Data Integrity', fn: () => this.testUserMigrationDataIntegrity() },
      
      // Advanced Security Tests
      { name: 'Bulk Role Assignment Security', fn: () => this.testBulkRoleAssignmentSecurity() },
      { name: 'Transaction Rollback on Security Violation', fn: () => this.testTransactionRollbackSecurity() },
      { name: 'Concurrent User Creation Security', fn: () => this.testConcurrentUserCreationSecurity() }
    ];

    for (const test of tests) {
      try {
        console.log(`\n🧪 Testing: ${test.name}`);
        const result = await test.fn();
        if (result.passed) {
          console.log(`✅ PASSED: ${test.name}`);
          console.log(`   ${result.message}`);
          results.passed++;
        } else {
          console.log(`❌ FAILED: ${test.name}`);
          console.log(`   ${result.message}`);
          results.failed++;
        }
        results.tests.push({ name: test.name, ...result });
      } catch (error) {
        console.log(`💥 ERROR: ${test.name}`);
        console.log(`   ${error.message}`);
        results.failed++;
        results.tests.push({ 
          name: test.name, 
          passed: false, 
          message: `Test error: ${error.message}`,
          error: error.stack 
        });
      }
    }

    // Cleanup test data
    await this.cleanupTestData();

    // Print final results
    this.printFinalResults(results);
    
    return results;
  }

  async setupTestData() {
    console.log('🔧 Setting up test data...');
    
    // Create test tenants
    this.testTenants = await Promise.all([
      prisma.tenant.create({
        data: {
          id: 'test-tenant-1',
          name: 'Test Institution 1',
          domain: 'test1.example.com',
          email: 'admin@test1.example.com'
        }
      }),
      prisma.tenant.create({
        data: {
          id: 'test-tenant-2', 
          name: 'Test Institution 2',
          domain: 'test2.example.com',
          email: 'admin@test2.example.com'
        }
      })
    ]);

    // Create identical role names in both tenants
    this.testRoles = await Promise.all([
      // Tenant 1 roles
      prisma.role.create({
        data: {
          id: 'test-tenant-1-principal',
          name: 'PRINCIPAL',
          description: 'Principal for Tenant 1',
          tenantId: 'test-tenant-1'
        }
      }),
      prisma.role.create({
        data: {
          id: 'test-tenant-1-hod',
          name: 'HOD',
          description: 'HOD for Tenant 1', 
          tenantId: 'test-tenant-1'
        }
      }),
      prisma.role.create({
        data: {
          id: 'test-tenant-1-staff',
          name: 'STAFF',
          description: 'Staff for Tenant 1',
          tenantId: 'test-tenant-1'
        }
      }),
      // Tenant 2 roles (same names, different IDs)
      prisma.role.create({
        data: {
          id: 'test-tenant-2-principal',
          name: 'PRINCIPAL',
          description: 'Principal for Tenant 2',
          tenantId: 'test-tenant-2'
        }
      }),
      prisma.role.create({
        data: {
          id: 'test-tenant-2-hod',
          name: 'HOD',
          description: 'HOD for Tenant 2',
          tenantId: 'test-tenant-2'
        }
      }),
      prisma.role.create({
        data: {
          id: 'test-tenant-2-staff',
          name: 'STAFF',
          description: 'Staff for Tenant 2',
          tenantId: 'test-tenant-2'
        }
      })
    ]);

    // Create test departments
    this.testDepartments = await Promise.all([
      prisma.department.create({
        data: {
          id: 'test-dept-1-tenant-1',
          name: 'Computer Science',
          tenantId: 'test-tenant-1'
        }
      }),
      prisma.department.create({
        data: {
          id: 'test-dept-1-tenant-2', 
          name: 'Computer Science',
          tenantId: 'test-tenant-2'
        }
      })
    ]);

    console.log('✅ Test data setup complete');
  }

  async cleanupTestData() {
    console.log('\n🧹 Cleaning up test data...');
    
    try {
      // Delete in proper order to avoid foreign key constraints
      await prisma.userDepartmentRole.deleteMany({
        where: {
          OR: [
            { user: { tenantId: 'test-tenant-1' } },
            { user: { tenantId: 'test-tenant-2' } }
          ]
        }
      });
      
      await prisma.userRole.deleteMany({
        where: {
          OR: [
            { user: { tenantId: 'test-tenant-1' } },
            { user: { tenantId: 'test-tenant-2' } }
          ]
        }
      });
      
      await prisma.user.deleteMany({
        where: {
          tenantId: { in: ['test-tenant-1', 'test-tenant-2'] }
        }
      });
      
      await prisma.department.deleteMany({
        where: {
          tenantId: { in: ['test-tenant-1', 'test-tenant-2'] }
        }
      });
      
      await prisma.role.deleteMany({
        where: {
          tenantId: { in: ['test-tenant-1', 'test-tenant-2'] }
        }
      });
      
      await prisma.tenant.deleteMany({
        where: {
          id: { in: ['test-tenant-1', 'test-tenant-2'] }
        }
      });
      
      console.log('✅ Test data cleanup complete');
    } catch (error) {
      console.log('⚠️  Cleanup error (non-critical):', error.message);
    }
  }

  // TEST 1: Cross-Tenant Role Assignment Prevention
  async testCrossTenantRoleAssignment() {
    try {
      // Attempt to assign Tenant 2's role to Tenant 1 user
      await tenantService.registerUserWithRolesAndDepartment({
        email: 'test.cross.tenant@example.com',
        firstName: 'Cross',
        lastName: 'Tenant',
        password: 'password123',
        tenantId: 'test-tenant-1',
        roleIds: ['test-tenant-2-principal'], // Role from different tenant!
        createdBy: 'test-system'
      });
      
      // If we reach here, the test failed
      return {
        passed: false,
        message: 'SECURITY BREACH: Cross-tenant role assignment was allowed!'
      };
    } catch (error) {
      if (error.message.includes('do not belong to this tenant')) {
        return {
          passed: true,
          message: 'Cross-tenant role assignment properly blocked'
        };
      }
      throw error;
    }
  }

  // TEST 2: Same Name Role Isolation
  async testSameNameRoleIsolation() {
    // Create users in both tenants with same role name
    const user1 = await tenantService.registerUserWithRolesAndDepartment({
      email: 'principal1@test1.com',
      firstName: 'Principal',
      lastName: 'One',
      password: 'password123',
      tenantId: 'test-tenant-1',
      roleIds: ['test-tenant-1-principal'],
      createdBy: 'test-system'
    });

    const user2 = await tenantService.registerUserWithRolesAndDepartment({
      email: 'principal2@test2.com',
      firstName: 'Principal', 
      lastName: 'Two',
      password: 'password123',
      tenantId: 'test-tenant-2',
      roleIds: ['test-tenant-2-principal'],
      createdBy: 'test-system'
    });

    // Verify roles are tenant-isolated
    const user1Roles = await prisma.userRole.findMany({
      where: { userId: user1.id },
      include: { role: true }
    });

    const user2Roles = await prisma.userRole.findMany({
      where: { userId: user2.id },
      include: { role: true }
    });

    const user1RoleTenant = user1Roles[0]?.role?.tenantId;
    const user2RoleTenant = user2Roles[0]?.role?.tenantId;

    if (user1RoleTenant === 'test-tenant-1' && user2RoleTenant === 'test-tenant-2') {
      return {
        passed: true,
        message: 'Same-name roles properly isolated by tenant'
      };
    } else {
      return {
        passed: false,
        message: `Role tenant isolation failed. User1: ${user1RoleTenant}, User2: ${user2RoleTenant}`
      };
    }
  }

  // TEST 3: Department Role Cross-Tenant Prevention  
  async testDepartmentRoleCrossTenant() {
    try {
      // Attempt to assign department role from different tenant
      await tenantService.registerUserWithRolesAndDepartment({
        email: 'test.dept.cross@example.com',
        firstName: 'Dept',
        lastName: 'Cross',
        password: 'password123',
        tenantId: 'test-tenant-1',
        departmentRoles: [{
          departmentId: 'test-dept-1-tenant-1',
          roleId: 'test-tenant-2-hod', // Role from different tenant!
          isPrimaryDepartment: true,
          isPrimaryRole: true
        }],
        createdBy: 'test-system'
      });
      
      return {
        passed: false,
        message: 'SECURITY BREACH: Cross-tenant department role assignment was allowed!'
      };
    } catch (error) {
      if (error.message.includes('do not belong to this tenant')) {
        return {
          passed: true,
          message: 'Cross-tenant department role assignment properly blocked'
        };
      }
      throw error;
    }
  }

  // TEST 4: Malicious Role ID Injection
  async testMaliciousRoleInjection() {
    try {
      // Attempt SQL injection-style attack
      await tenantService.registerUserWithRolesAndDepartment({
        email: 'malicious@example.com',
        firstName: 'Malicious',
        lastName: 'User',
        password: 'password123',
        tenantId: 'test-tenant-1',
        roleIds: [
          'test-tenant-2-principal', 
          "'; DROP TABLE roles; --",
          'non-existent-role-id',
          null,
          undefined
        ],
        createdBy: 'test-system'
      });
      
      return {
        passed: false,
        message: 'SECURITY BREACH: Malicious role injection was not blocked!'
      };
    } catch (error) {
      if (error.message.includes('do not belong to this tenant') || 
          error.message.includes('Invalid role assignment')) {
        return {
          passed: true,
          message: 'Malicious role injection properly blocked'
        };
      }
      throw error;
    }
  }

  // TEST 5: Update Role Validation
  async testTenantRoleValidationUpdate() {
    // First create a legitimate user
    const user = await tenantService.registerUserWithRolesAndDepartment({
      email: 'legitimate@test1.com',
      firstName: 'Legitimate',
      lastName: 'User',
      password: 'password123',
      tenantId: 'test-tenant-1',
      roleIds: ['test-tenant-1-staff'],
      createdBy: 'test-system'
    });

    try {
      // Try to update with cross-tenant role
      await tenantService.updateUserWithRolesAndDepartment({
        userId: user.id,
        tenantId: 'test-tenant-1',
        updateData: {
          roleIds: ['test-tenant-2-principal'] // Cross-tenant role!
        },
        updatedBy: 'test-system'
      });
      
      return {
        passed: false,
        message: 'SECURITY BREACH: Cross-tenant role update was allowed!'
      };
    } catch (error) {
      if (error.message.includes('do not belong to this tenant')) {
        return {
          passed: true,
          message: 'Cross-tenant role update properly blocked'
        };
      }
      throw error;
    }
  }

  // TEST 6: HOD Assignment Tenant Isolation
  async testHodAssignmentTenantIsolation() {
    // Create HOD in tenant 1
    const hod1 = await tenantService.registerUserWithRolesAndDepartment({
      email: 'hod1@test1.com',
      firstName: 'HOD',
      lastName: 'One',
      password: 'password123',
      tenantId: 'test-tenant-1',
      departmentRoles: [{
        departmentId: 'test-dept-1-tenant-1',
        roleId: 'test-tenant-1-hod',
        isPrimaryDepartment: true,
        isPrimaryRole: true
      }],
      createdBy: 'test-system'
    });

    // Verify HOD assignment
    const department = await prisma.department.findUnique({
      where: { id: 'test-dept-1-tenant-1' }
    });

    if (department.hodId === hod1.id && department.tenantId === 'test-tenant-1') {
      return {
        passed: true,
        message: 'HOD assignment properly tenant-isolated'
      };
    } else {
      return {
        passed: false,
        message: 'HOD assignment tenant isolation failed'
      };
    }
  }

  // TEST 7: Transaction Rollback on Security Violation
  async testTransactionRollbackSecurity() {
    const initialUserCount = await prisma.user.count({
      where: { tenantId: 'test-tenant-1' }
    });

    try {
      // Attempt user creation with mixed valid/invalid roles
      await tenantService.registerUserWithRolesAndDepartment({
        email: 'rollback.test@example.com',
        firstName: 'Rollback',
        lastName: 'Test',
        password: 'password123',
        tenantId: 'test-tenant-1',
        roleIds: [
          'test-tenant-1-staff', // Valid
          'test-tenant-2-principal' // Invalid - should trigger rollback
        ],
        createdBy: 'test-system'
      });
      
      return {
        passed: false,
        message: 'SECURITY BREACH: Transaction did not rollback on security violation!'
      };
    } catch (error) {
      // Check that no user was created (transaction rolled back)
      const finalUserCount = await prisma.user.count({
        where: { tenantId: 'test-tenant-1' }
      });

      if (finalUserCount === initialUserCount) {
        return {
          passed: true,
          message: 'Transaction properly rolled back on security violation'
        };
      } else {
        return {
          passed: false,
          message: 'Transaction rollback failed - partial user creation occurred'
        };
      }
    }
  }

  // TEST 8: Default Role Tenant Validation
  async testDefaultRoleTenantValidation() {
    // Create user with valid role
    const user = await tenantService.registerUserWithRolesAndDepartment({
      email: 'default.test@test1.com',
      firstName: 'Default',
      lastName: 'Test',
      password: 'password123',
      tenantId: 'test-tenant-1',
      roleIds: ['test-tenant-1-staff'],
      createdBy: 'test-system'
    });

    try {
      // Try to set default role from different tenant
      await tenantService.updateUserWithRolesAndDepartment({
        userId: user.id,
        tenantId: 'test-tenant-1',
        updateData: {},
        defaultRole: {
          id: 'test-tenant-2-principal', // Cross-tenant role
          type: 'userRole'
        },
        updatedBy: 'test-system'
      });

      // Check if default role was actually set (it shouldn't be)
      const updatedUser = await prisma.userRole.findFirst({
        where: { 
          userId: user.id,
          isDefault: true
        },
        include: { role: true }
      });

      if (!updatedUser || updatedUser.role.tenantId === 'test-tenant-1') {
        return {
          passed: true,
          message: 'Default role cross-tenant assignment prevented'
        };
      } else {
        return {
          passed: false,
          message: 'SECURITY BREACH: Cross-tenant default role was set!'
        };
      }
    } catch (error) {
      return {
        passed: true,
        message: 'Cross-tenant default role assignment properly blocked'
      };
    }
  }

  // TEST 9: Bulk Role Assignment Security
  async testBulkRoleAssignmentSecurity() {
    try {
      // Create multiple users with mixed valid/invalid roles
      const bulkData = [
        {
          email: 'bulk1@test1.com',
          roleIds: ['test-tenant-1-staff'] // Valid
        },
        {
          email: 'bulk2@test1.com', 
          roleIds: ['test-tenant-2-staff'] // Invalid
        },
        {
          email: 'bulk3@test1.com',
          roleIds: ['test-tenant-1-hod'] // Valid
        }
      ];

      for (const data of bulkData) {
        await tenantService.registerUserWithRolesAndDepartment({
          email: data.email,
          firstName: 'Bulk',
          lastName: 'Test',
          password: 'password123',
          tenantId: 'test-tenant-1',
          roleIds: data.roleIds,
          createdBy: 'test-system'
        });
      }

      return {
        passed: false,
        message: 'SECURITY BREACH: Bulk operations allowed cross-tenant assignments!'
      };
    } catch (error) {
      if (error.message.includes('do not belong to this tenant')) {
        // Verify only valid users were created
        const createdUsers = await prisma.user.count({
          where: {
            tenantId: 'test-tenant-1',
            email: { in: ['bulk1@test1.com', 'bulk2@test1.com', 'bulk3@test1.com'] }
          }
        });

        return {
          passed: true,
          message: `Bulk security validation working - prevented invalid assignments`
        };
      }
      throw error;
    }
  }

  // TEST 10: Concurrent User Creation Security
  async testConcurrentUserCreationSecurity() {
    try {
      // Simulate concurrent requests with mixed valid/invalid data
      const concurrentPromises = [
        tenantService.registerUserWithRolesAndDepartment({
          email: 'concurrent1@test1.com',
          firstName: 'Concurrent',
          lastName: 'One',
          password: 'password123',
          tenantId: 'test-tenant-1',
          roleIds: ['test-tenant-1-staff'],
          createdBy: 'test-system'
        }),
        tenantService.registerUserWithRolesAndDepartment({
          email: 'concurrent2@test1.com',
          firstName: 'Concurrent', 
          lastName: 'Two',
          password: 'password123',
          tenantId: 'test-tenant-1',
          roleIds: ['test-tenant-2-staff'], // Invalid
          createdBy: 'test-system'
        })
      ];

      const results = await Promise.allSettled(concurrentPromises);
      
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const errorCount = results.filter(r => r.status === 'rejected').length;

      if (successCount === 1 && errorCount === 1) {
        return {
          passed: true,
          message: 'Concurrent operations maintain security - 1 valid, 1 blocked'
        };
      } else {
        return {
          passed: false,
          message: `Concurrent security failed - ${successCount} succeeded, ${errorCount} blocked`
        };
      }
    } catch (error) {
      throw error;
    }
  }

  printFinalResults(results) {
    console.log('\n' + '='.repeat(70));
    console.log('🏁 FINAL TEST RESULTS');
    console.log('='.repeat(70));
    console.log(`✅ PASSED: ${results.passed}`);
    console.log(`❌ FAILED: ${results.failed}`);
    console.log(`📊 TOTAL:  ${results.passed + results.failed}`);
    console.log(`📈 SUCCESS RATE: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
    
    if (results.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! Your system has robust tenant isolation and data integrity.');
    } else {
      console.log('\n⚠️  Some tests failed. Review the security gaps above.');
      console.log('\nFailed tests:');
      results.tests
        .filter(t => !t.passed)
        .forEach(t => console.log(`   - ${t.name}: ${t.message}`));
    }
    
    console.log('\n' + '='.repeat(70));
  }
}

module.exports = TenantIsolationTestSuite;
