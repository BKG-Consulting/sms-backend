-- Add database-level constraints for tenant data integrity
-- Run this after your regular Prisma migrations

-- 1. Add composite unique constraints to prevent cross-tenant data mixing
ALTER TABLE "UserRole" 
ADD CONSTRAINT "user_role_tenant_consistency" 
CHECK (
  NOT EXISTS (
    SELECT 1 FROM "User" u, "Role" r 
    WHERE u.id = "UserRole"."userId" 
    AND r.id = "UserRole"."roleId" 
    AND u."tenantId" != r."tenantId"
  )
);

-- 2. Add constraint for UserDepartmentRole tenant consistency
ALTER TABLE "UserDepartmentRole" 
ADD CONSTRAINT "user_dept_role_tenant_consistency" 
CHECK (
  NOT EXISTS (
    SELECT 1 FROM "User" u, "Department" d, "Role" r 
    WHERE u.id = "UserDepartmentRole"."userId" 
    AND d.id = "UserDepartmentRole"."departmentId" 
    AND r.id = "UserDepartmentRole"."roleId" 
    AND NOT (u."tenantId" = d."tenantId" AND d."tenantId" = r."tenantId")
  )
);

-- 3. Add constraint for Department HOD tenant consistency
ALTER TABLE "Department" 
ADD CONSTRAINT "department_hod_tenant_consistency" 
CHECK (
  "hodId" IS NULL OR 
  NOT EXISTS (
    SELECT 1 FROM "User" u 
    WHERE u.id = "Department"."hodId" 
    AND u."tenantId" != "Department"."tenantId"
  )
);

-- 4. Add constraint for Audit lead auditor tenant consistency
ALTER TABLE "Audit" 
ADD CONSTRAINT "audit_lead_auditor_tenant_consistency" 
CHECK (
  "leadAuditorId" IS NULL OR 
  NOT EXISTS (
    SELECT 1 FROM "User" u, "AuditProgram" ap 
    WHERE u.id = "Audit"."leadAuditorId" 
    AND ap.id = "Audit"."auditProgramId" 
    AND u."tenantId" != ap."tenantId"
  )
);

-- 5. Add constraint for AuditTeam member tenant consistency
ALTER TABLE "AuditTeam" 
ADD CONSTRAINT "audit_team_tenant_consistency" 
CHECK (
  NOT EXISTS (
    SELECT 1 FROM "User" u, "Audit" a, "AuditProgram" ap 
    WHERE u.id = "AuditTeam"."auditorId" 
    AND a.id = "AuditTeam"."auditId" 
    AND ap.id = a."auditProgramId" 
    AND u."tenantId" != ap."tenantId"
  )
);

-- 6. Add indexes for better performance on tenant-scoped queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_tenant_email" ON "User"("tenantId", "email");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_role_tenant_name" ON "Role"("tenantId", "name");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_department_tenant_name" ON "Department"("tenantId", "name");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_program_tenant_status" ON "AuditProgram"("tenantId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_tenant_status" ON "Audit"("auditProgramId") INCLUDE ("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_document_tenant_type" ON "Document"("tenantId", "type");

-- 7. Add partial indexes for active records only (better performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_user_active_tenant" 
ON "User"("tenantId") 
WHERE "verified" = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_audit_program_active_tenant" 
ON "AuditProgram"("tenantId") 
WHERE "status" IN ('ACTIVE', 'PLANNING');

-- 8. Create a function to validate tenant ownership (can be used in triggers)
CREATE OR REPLACE FUNCTION validate_tenant_ownership(
  p_tenant_id UUID,
  p_resource_type TEXT,
  p_resource_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  CASE p_resource_type
    WHEN 'user' THEN
      RETURN EXISTS (SELECT 1 FROM "User" WHERE id = p_resource_id AND "tenantId" = p_tenant_id);
    WHEN 'role' THEN
      RETURN EXISTS (SELECT 1 FROM "Role" WHERE id = p_resource_id AND "tenantId" = p_tenant_id);
    WHEN 'department' THEN
      RETURN EXISTS (SELECT 1 FROM "Department" WHERE id = p_resource_id AND "tenantId" = p_tenant_id);
    WHEN 'auditProgram' THEN
      RETURN EXISTS (SELECT 1 FROM "AuditProgram" WHERE id = p_resource_id AND "tenantId" = p_tenant_id);
    WHEN 'document' THEN
      RETURN EXISTS (SELECT 1 FROM "Document" WHERE id = p_resource_id AND "tenantId" = p_tenant_id);
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 9. Create a trigger function to log tenant isolation violations
CREATE OR REPLACE FUNCTION log_tenant_violation() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "AuditLog" ("id", "tenantId", "userId", "action", "entityType", "entityId", "details", "ipAddress", "timestamp")
  VALUES (
    gen_random_uuid(),
    COALESCE(NEW."tenantId", OLD."tenantId"),
    'system',
    'TENANT_VIOLATION_DETECTED',
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'violation_type', 'constraint_check_failed',
      'table', TG_TABLE_NAME,
      'operation', TG_OP
    ),
    'system',
    NOW()
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 10. Add RLS (Row Level Security) policies for additional protection
-- Enable RLS on critical tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditProgram" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (these will be enforced when using RLS-enabled connections)
-- Note: Your application should use these policies for additional security
CREATE POLICY "tenant_isolation_users" ON "User"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY "tenant_isolation_roles" ON "Role"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY "tenant_isolation_departments" ON "Department"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY "tenant_isolation_audit_programs" ON "AuditProgram"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true)::UUID);

-- 11. Create a view for cross-tenant data integrity monitoring
CREATE OR REPLACE VIEW tenant_integrity_violations AS
SELECT 
  'UserRole Cross-Tenant' as violation_type,
  ur.id as record_id,
  u."tenantId" as user_tenant,
  r."tenantId" as role_tenant,
  'UserRole' as table_name
FROM "UserRole" ur
JOIN "User" u ON ur."userId" = u.id
JOIN "Role" r ON ur."roleId" = r.id
WHERE u."tenantId" != r."tenantId"

UNION ALL

SELECT 
  'Department HOD Cross-Tenant' as violation_type,
  d.id as record_id,
  d."tenantId" as dept_tenant,
  u."tenantId" as hod_tenant,
  'Department' as table_name
FROM "Department" d
JOIN "User" u ON d."hodId" = u.id
WHERE d."tenantId" != u."tenantId"

UNION ALL

SELECT 
  'Audit Lead Auditor Cross-Tenant' as violation_type,
  a.id as record_id,
  ap."tenantId" as program_tenant,
  u."tenantId" as auditor_tenant,
  'Audit' as table_name
FROM "Audit" a
JOIN "AuditProgram" ap ON a."auditProgramId" = ap.id
JOIN "User" u ON a."leadAuditorId" = u.id
WHERE ap."tenantId" != u."tenantId";

-- Add comment for documentation
COMMENT ON VIEW tenant_integrity_violations IS 'Monitors cross-tenant data integrity violations';

-- Usage examples:
-- SELECT * FROM tenant_integrity_violations; -- Check for violations
-- SELECT validate_tenant_ownership('tenant-uuid', 'user', 'user-uuid'); -- Validate ownership

