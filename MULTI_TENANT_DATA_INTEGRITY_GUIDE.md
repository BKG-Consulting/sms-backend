# Multi-Tenant Data Integrity Guide

## Overview

Your multi-tenant school management system requires bulletproof data isolation to ensure each school's data remains completely separate and secure. This guide outlines the comprehensive approach to achieving data integrity with a single PostgreSQL database.

## Current Implementation Analysis

### ✅ What You Have (Good Foundation)
- **Schema-level tenant isolation** with `tenantId` foreign keys
- **JWT token tenant context** embedded in authentication
- **Middleware tenant extraction** in auth middleware
- **Repository-level filtering** in some repositories
- **Cross-tenant validation** in tenant service

### ⚠️ Critical Gaps Identified
- **Inconsistent tenant filtering** across repositories
- **No automatic tenant injection** for create operations
- **Lack of database-level constraints** for tenant boundaries
- **No bulk operation validation**
- **Missing integrity monitoring**

## Enhanced Security Implementation

### 1. Tenant Isolation Middleware (`src/middleware/tenantIsolationMiddleware.js`)

```javascript
// Usage example
router.get('/users/:userId', 
  authenticateToken,
  enforceTenantIsolation([
    { type: 'user', paramName: 'userId', required: true }
  ]),
  handler
);
```

**Features:**
- ✅ Automatic route parameter validation
- ✅ Cross-tenant access prevention
- ✅ Resource ownership verification
- ✅ Tenant-aware Prisma client extension

### 2. Safety Hooks (`src/utils/tenantSafetyHooks.js`)

```javascript
// Usage example
const safeService = createTenantSafeService(userTenantId);
const userData = await safeService.create('user', {
  email, firstName, lastName, roleIds
});
```

**Features:**
- ✅ Pre-operation tenant validation
- ✅ Automatic tenant ID injection
- ✅ Cross-reference validation
- ✅ Bulk operation safety
- ✅ Integrity monitoring

### 3. Database Constraints (`prisma/migrations/add_tenant_integrity_constraints.sql`)

**Features:**
- ✅ Check constraints preventing cross-tenant references
- ✅ Performance indexes for tenant-scoped queries
- ✅ Row Level Security (RLS) policies
- ✅ Integrity violation monitoring views
- ✅ Database functions for validation

## Implementation Strategy

### Phase 1: Foundation (Immediate)
1. **Deploy the enhanced middleware and hooks**
2. **Run the database constraints migration**
3. **Update critical routes** (user, role, department management)

### Phase 2: Comprehensive Protection (Next Sprint)
1. **Apply tenant isolation to all routes**
2. **Implement automatic tenant filtering in all repositories**
3. **Add integrity monitoring dashboard**

### Phase 3: Advanced Features (Future)
1. **Implement tenant-aware caching**
2. **Add automated violation alerting**
3. **Create data migration tools**

## Best Practices for Your Multi-Tenant System

### 1. Always Filter by Tenant
```javascript
// ❌ Dangerous - no tenant filtering
const users = await prisma.user.findMany();

// ✅ Safe - explicit tenant filtering
const users = await prisma.user.findMany({
  where: { tenantId: req.user.tenantId }
});
```

### 2. Validate Cross-References
```javascript
// ❌ Dangerous - no validation of role ownership
await prisma.userRole.create({
  data: { userId, roleId }
});

// ✅ Safe - validate role belongs to same tenant
await TenantSafetyHooks.validateTenantConsistency('create', {
  userId, roleId
}, userTenantId);
```

### 3. Use Transactions for Multi-Table Operations
```javascript
// ✅ Safe - atomic operations with validation
const result = await prisma.$transaction(async (tx) => {
  await validateTenantConsistency(data, tenantId);
  const user = await tx.user.create({ data });
  await tx.userRole.createMany({ data: roleAssignments });
  return user;
});
```

### 4. Implement Route-Level Protection
```javascript
// ✅ Safe - route-level tenant isolation
router.post('/audit-programs/:programId/audits',
  authenticateToken,
  enforceTenantIsolation([
    { type: 'auditProgram', paramName: 'programId', required: true }
  ]),
  createAuditHandler
);
```

## Data Architecture Recommendations

### 1. Database Level
- **Foreign key constraints** with tenant validation
- **Check constraints** preventing cross-tenant references
- **Partial indexes** for tenant-scoped queries
- **Row Level Security** as additional protection layer

### 2. Application Level
- **Middleware enforcement** on all routes
- **Service layer validation** for business logic
- **Repository pattern** with automatic tenant filtering
- **Transaction safety** for complex operations

### 3. Monitoring & Compliance
- **Integrity violation detection**
- **Audit logging** for tenant boundary crossings
- **Regular integrity checks**
- **Automated alerting** for violations

## Migration Strategy

### For Existing Data
```sql
-- 1. Run integrity check
SELECT * FROM tenant_integrity_violations;

-- 2. Fix any violations before applying constraints
-- 3. Apply the database constraints
\i prisma/migrations/add_tenant_integrity_constraints.sql

-- 4. Enable RLS (optional, for additional security)
-- Note: This requires application changes to set tenant context
```

### For New Features
1. **Always use tenant isolation middleware**
2. **Validate cross-references with safety hooks**
3. **Include integrity tests in your test suite**
4. **Monitor for violations in production**

## Testing Your Implementation

### Unit Tests
```javascript
describe('Tenant Isolation', () => {
  it('should prevent cross-tenant user access', async () => {
    // Test that user from tenant A cannot access user from tenant B
  });
  
  it('should validate role assignments', async () => {
    // Test that roles can only be assigned within same tenant
  });
});
```

### Integration Tests
```javascript
describe('API Tenant Security', () => {
  it('should return 403 for cross-tenant resource access', async () => {
    // Test route-level protection
  });
});
```

## Production Deployment

### 1. Pre-Deployment
- Run integrity check on existing data
- Test migrations in staging environment
- Verify no existing violations

### 2. Deployment
```bash
# 1. Deploy application code
# 2. Run database migrations
npm run prisma:migrate:deploy

# 3. Apply integrity constraints
psql $DATABASE_URL -f prisma/migrations/add_tenant_integrity_constraints.sql

# 4. Run post-deployment integrity check
npm run integrity:check
```

### 3. Post-Deployment
- Monitor for constraint violations
- Set up alerting for integrity issues
- Regular integrity audits

## Monitoring Dashboard Queries

```sql
-- Daily integrity check
SELECT 
  COUNT(*) as violation_count,
  violation_type,
  table_name
FROM tenant_integrity_violations 
GROUP BY violation_type, table_name;

-- Tenant data statistics
SELECT 
  t.name as tenant_name,
  COUNT(DISTINCT u.id) as users,
  COUNT(DISTINCT r.id) as roles,
  COUNT(DISTINCT d.id) as departments,
  COUNT(DISTINCT ap.id) as audit_programs
FROM "Tenant" t
LEFT JOIN "User" u ON t.id = u."tenantId"
LEFT JOIN "Role" r ON t.id = r."tenantId"
LEFT JOIN "Department" d ON t.id = d."tenantId"
LEFT JOIN "AuditProgram" ap ON t.id = ap."tenantId"
GROUP BY t.id, t.name
ORDER BY users DESC;
```

## Emergency Procedures

### If Tenant Violation Detected
1. **Immediate action**: Log the violation
2. **Investigate**: Check audit logs for cause
3. **Remediate**: Fix data if needed
4. **Prevent**: Add additional constraints if gap found

### Data Recovery
- All operations are logged in AuditLog table
- Use transaction logs for point-in-time recovery
- Backup strategy should be tenant-aware

## Compliance & Security

### GDPR/Data Protection
- **Data portability**: Export data by tenant
- **Right to erasure**: Delete all tenant data
- **Data minimization**: Tenant-scoped data access

### Security Audit
- Regular integrity checks
- Penetration testing for tenant isolation
- Code review for tenant filtering
- Database constraint validation

## Conclusion

This comprehensive approach provides:
- **Defense in depth** with multiple security layers
- **Automatic enforcement** reducing human error
- **Performance optimization** with proper indexing
- **Monitoring capabilities** for ongoing compliance
- **Scalability** for growth

Your school management system will have enterprise-grade data isolation ensuring each school's data remains completely secure and separate.


