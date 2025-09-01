const { logger } = require('../utils/logger');
const { prisma } = require('../../prisma/client');

/**
 * Enhanced tenant isolation middleware for multi-tenant data integrity
 * This middleware ensures every database operation respects tenant boundaries
 */

class TenantIsolationError extends Error {
  constructor(message, tenantId, resourceId) {
    super(message);
    this.name = 'TenantIsolationError';
    this.tenantId = tenantId;
    this.resourceId = resourceId;
    this.code = 'TENANT_ISOLATION_VIOLATION';
  }
}

/**
 * Validates that a resource belongs to the authenticated user's tenant
 */
async function validateResourceTenantOwnership(resourceType, resourceId, userTenantId, tx = prisma) {
  if (!resourceId || !userTenantId) return false;

  const queries = {
    user: () => tx.user.findFirst({ 
      where: { id: resourceId, tenantId: userTenantId }, 
      select: { id: true } 
    }),
    
    role: () => tx.role.findFirst({ 
      where: { id: resourceId, tenantId: userTenantId }, 
      select: { id: true } 
    }),
    
    department: () => tx.department.findFirst({ 
      where: { id: resourceId, tenantId: userTenantId }, 
      select: { id: true } 
    }),
    
    audit: () => tx.audit.findFirst({ 
      where: { 
        id: resourceId, 
        auditProgram: { tenantId: userTenantId } 
      }, 
      select: { id: true } 
    }),
    
    auditProgram: () => tx.auditProgram.findFirst({ 
      where: { id: resourceId, tenantId: userTenantId }, 
      select: { id: true } 
    }),
    
    document: () => tx.document.findFirst({ 
      where: { id: resourceId, tenantId: userTenantId }, 
      select: { id: true } 
    }),
    
    finding: () => tx.auditFinding.findFirst({ 
      where: { 
        id: resourceId, 
        audit: { auditProgram: { tenantId: userTenantId } } 
      }, 
      select: { id: true } 
    }),
    
    checklist: () => tx.checklist.findFirst({ 
      where: { 
        id: resourceId, 
        audit: { auditProgram: { tenantId: userTenantId } } 
      }, 
      select: { id: true } 
    }),
    
    campus: () => tx.campus.findFirst({ 
      where: { id: resourceId, tenantId: userTenantId }, 
      select: { id: true } 
    }),
    
    // Add more resource types as needed
  };

  const query = queries[resourceType];
  if (!query) {
    logger.warn('Unknown resource type for tenant validation', { resourceType, resourceId });
    return false;
  }

  try {
    const resource = await query();
    return !!resource;
  } catch (error) {
    logger.error('Error validating resource tenant ownership', {
      resourceType,
      resourceId,
      userTenantId,
      error: error.message
    });
    return false;
  }
}

/**
 * Middleware to enforce tenant isolation on route parameters
 */
function enforceTenantIsolation(resourceTypes = []) {
  return async (req, res, next) => {
    try {
      const userTenantId = req.user?.tenantId;
      
      if (!userTenantId) {
        logger.error('No tenant context in request', { userId: req.user?.userId });
        return res.status(403).json({
          error: {
            message: 'Tenant context required',
            code: 'NO_TENANT_CONTEXT'
          }
        });
      }

      // Validate tenant isolation for specified resource types
      for (const resourceConfig of resourceTypes) {
        const { type, paramName, required = true } = resourceConfig;
        const resourceId = req.params[paramName];
        
        if (!resourceId) {
          if (required) {
            return res.status(400).json({
              error: {
                message: `Missing required parameter: ${paramName}`,
                code: 'MISSING_PARAMETER'
              }
            });
          }
          continue;
        }

        const isAuthorized = await validateResourceTenantOwnership(
          type, 
          resourceId, 
          userTenantId
        );

        if (!isAuthorized) {
          logger.error('Tenant isolation violation detected', {
            userId: req.user.userId,
            userTenantId,
            resourceType: type,
            resourceId,
            route: req.route?.path,
            method: req.method
          });

          throw new TenantIsolationError(
            `Access denied: ${type} does not belong to your organization`,
            userTenantId,
            resourceId
          );
        }
      }

      next();
    } catch (error) {
      if (error instanceof TenantIsolationError) {
        return res.status(403).json({
          error: {
            message: error.message,
            code: error.code,
            details: {
              tenantId: error.tenantId,
              resourceId: error.resourceId
            }
          }
        });
      }
      next(error);
    }
  };
}

/**
 * Prisma extension to automatically filter queries by tenant
 */
function createTenantAwarePrisma(userTenantId) {
  if (!userTenantId) {
    throw new Error('Tenant ID required for tenant-aware Prisma client');
  }

  return prisma.$extends({
    query: {
      // Auto-filter tenant-scoped models
      user: {
        findMany: ({ args, query }) => {
          args.where = { ...args.where, tenantId: userTenantId };
          return query(args);
        },
        findFirst: ({ args, query }) => {
          args.where = { ...args.where, tenantId: userTenantId };
          return query(args);
        },
        findUnique: ({ args, query }) => {
          // For unique queries, we validate after fetch
          return query(args).then(result => {
            if (result && result.tenantId !== userTenantId) {
              logger.error('Tenant isolation violation in findUnique', {
                model: 'user',
                userTenantId,
                resourceTenantId: result.tenantId
              });
              return null;
            }
            return result;
          });
        }
      },
      
      role: {
        findMany: ({ args, query }) => {
          args.where = { ...args.where, tenantId: userTenantId };
          return query(args);
        },
        findFirst: ({ args, query }) => {
          args.where = { ...args.where, tenantId: userTenantId };
          return query(args);
        }
      },
      
      department: {
        findMany: ({ args, query }) => {
          args.where = { ...args.where, tenantId: userTenantId };
          return query(args);
        },
        findFirst: ({ args, query }) => {
          args.where = { ...args.where, tenantId: userTenantId };
          return query(args);
        }
      },
      
      auditProgram: {
        findMany: ({ args, query }) => {
          args.where = { ...args.where, tenantId: userTenantId };
          return query(args);
        },
        findFirst: ({ args, query }) => {
          args.where = { ...args.where, tenantId: userTenantId };
          return query(args);
        }
      }
      
      // Add more models as needed
    }
  });
}

/**
 * Utility to validate bulk operations respect tenant boundaries
 */
async function validateBulkTenantOwnership(resourceType, resourceIds, userTenantId, tx = prisma) {
  if (!resourceIds || resourceIds.length === 0) return true;
  
  const validationPromises = resourceIds.map(id => 
    validateResourceTenantOwnership(resourceType, id, userTenantId, tx)
  );
  
  const results = await Promise.all(validationPromises);
  const invalidIds = resourceIds.filter((id, index) => !results[index]);
  
  if (invalidIds.length > 0) {
    throw new TenantIsolationError(
      `Access denied: ${invalidIds.length} ${resourceType}(s) do not belong to your organization`,
      userTenantId,
      invalidIds
    );
  }
  
  return true;
}

module.exports = {
  enforceTenantIsolation,
  validateResourceTenantOwnership,
  validateBulkTenantOwnership,
  createTenantAwarePrisma,
  TenantIsolationError
};
