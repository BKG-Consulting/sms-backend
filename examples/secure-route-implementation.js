/**
 * Example implementation of secure multi-tenant routes
 * This shows how to use the new tenant isolation middleware and safety hooks
 */

const express = require('express');
const { authenticateToken } = require('../src/middleware/authMiddleware');
const { enforceTenantIsolation } = require('../src/middleware/tenantIsolationMiddleware');
const { TenantSafetyHooks, createTenantSafeService } = require('../src/utils/tenantSafetyHooks');
const { prisma } = require('../prisma/client');
const router = express.Router();

// Example 1: User Management with Enhanced Tenant Security
router.get('/users/:userId', 
  authenticateToken,
  enforceTenantIsolation([
    { type: 'user', paramName: 'userId', required: true }
  ]),
  async (req, res, next) => {
    try {
      // At this point, we're guaranteed the user belongs to the requesting tenant
      const user = await prisma.user.findUnique({
        where: { id: req.params.userId },
        include: {
          userRoles: {
            include: { role: true }
          },
          userDepartmentRoles: {
            include: { department: true, role: true }
          }
        }
      });

      res.json({ user });
    } catch (error) {
      next(error);
    }
  }
);

// Example 2: Creating User with Tenant Safety Validation
router.post('/users',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { email, firstName, lastName, roleIds, departmentIds } = req.body;
      const userTenantId = req.user.tenantId;
      
      // Create tenant-safe service instance
      const safeService = createTenantSafeService(userTenantId);
      
      // Prepare user data with automatic tenant injection
      const userData = await safeService.create('user', {
        email,
        firstName,
        lastName,
        roleIds,
        departmentIds
      });

      // Additional validation for role and department assignments
      await TenantSafetyHooks.validateTenantConsistency('create', userData, userTenantId);

      // Create user in transaction to ensure atomicity
      const user = await prisma.$transaction(async (tx) => {
        // Create the user
        const newUser = await tx.user.create({
          data: {
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            tenantId: userData.tenantId
          }
        });

        // Assign roles (all pre-validated to belong to same tenant)
        if (roleIds && roleIds.length > 0) {
          await tx.userRole.createMany({
            data: roleIds.map(roleId => ({
              userId: newUser.id,
              roleId
            }))
          });
        }

        return newUser;
      });

      res.status(201).json({ user });
    } catch (error) {
      next(error);
    }
  }
);

// Example 3: Audit Management with Multi-Resource Validation
router.post('/audits',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { auditProgramId, leadAuditorId, teamMemberIds, title, scope } = req.body;
      const userTenantId = req.user.tenantId;

      // Validate all referenced resources belong to the same tenant
      await TenantSafetyHooks.validateTenantConsistency('create', {
        auditProgramId,
        userId: leadAuditorId,
        userIds: teamMemberIds
      }, userTenantId);

      const audit = await prisma.$transaction(async (tx) => {
        // Create audit
        const newAudit = await tx.audit.create({
          data: {
            title,
            scope,
            auditProgramId,
            leadAuditorId,
            status: 'PLANNING'
          }
        });

        // Add team members
        if (teamMemberIds && teamMemberIds.length > 0) {
          await tx.auditTeam.createMany({
            data: teamMemberIds.map(auditorId => ({
              auditId: newAudit.id,
              auditorId,
              role: 'AUDITOR'
            }))
          });
        }

        return newAudit;
      });

      res.status(201).json({ audit });
    } catch (error) {
      next(error);
    }
  }
);

// Example 4: Bulk Operations with Tenant Validation
router.post('/users/bulk-update-roles',
  authenticateToken,
  async (req, res, next) => {
    try {
      const { userIds, roleIds } = req.body;
      const userTenantId = req.user.tenantId;

      // Validate bulk operations
      await Promise.all([
        TenantSafetyHooks.validateTenantConsistency('update', { userIds }, userTenantId),
        TenantSafetyHooks.validateTenantConsistency('update', { roleIds }, userTenantId)
      ]);

      const result = await prisma.$transaction(async (tx) => {
        // Remove existing role assignments for these users
        await tx.userRole.deleteMany({
          where: { 
            userId: { in: userIds },
            user: { tenantId: userTenantId } // Double-check tenant boundary
          }
        });

        // Add new role assignments
        const assignments = [];
        for (const userId of userIds) {
          for (const roleId of roleIds) {
            assignments.push({ userId, roleId });
          }
        }

        await tx.userRole.createMany({
          data: assignments
        });

        return { updated: userIds.length, assignedRoles: roleIds.length };
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Example 5: Data Integrity Check Endpoint
router.get('/integrity-check',
  authenticateToken,
  async (req, res, next) => {
    try {
      const userTenantId = req.user.tenantId;
      
      // Perform comprehensive integrity check
      const integrityReport = await TenantSafetyHooks.performIntegrityCheck(userTenantId);
      
      res.json(integrityReport);
    } catch (error) {
      next(error);
    }
  }
);

// Example 6: Cross-Tenant Violation Monitoring (Admin only)
router.get('/violations',
  authenticateToken,
  // requireRole('SUPER_ADMIN'), // Uncomment if you have this middleware
  async (req, res, next) => {
    try {
      // Query the violations view we created
      const violations = await prisma.$queryRaw`
        SELECT * FROM tenant_integrity_violations
        ORDER BY violation_type, record_id
      `;

      res.json({ violations, count: violations.length });
    } catch (error) {
      next(error);
    }
  }
);

// Example 7: Enhanced Query with Automatic Tenant Filtering
router.get('/departments',
  authenticateToken,
  async (req, res, next) => {
    try {
      const userTenantId = req.user.tenantId;
      
      // Using explicit tenant filtering (recommended approach)
      const departments = await prisma.department.findMany({
        where: { 
          tenantId: userTenantId 
        },
        include: {
          hod: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          users: {
            where: { tenantId: userTenantId }, // Ensure nested queries also respect tenant
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      res.json({ departments });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

/**
 * Usage in your main routes file:
 * 
 * const secureRoutes = require('./examples/secure-route-implementation');
 * app.use('/api/secure', secureRoutes);
 * 
 * This provides:
 * 1. Automatic tenant isolation validation
 * 2. Cross-reference validation
 * 3. Bulk operation safety
 * 4. Integrity monitoring
 * 5. Database-level constraints
 */

