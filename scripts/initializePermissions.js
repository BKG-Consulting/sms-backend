const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const systemAdminPermissions = [
  // Tenant Management
  { module: 'tenant', action: 'read', description: 'View tenant information' },
  { module: 'tenant', action: 'update', description: 'Update tenant settings' },
  { module: 'tenant', action: 'delete', description: 'Delete tenant' },
  { module: 'branding', action: 'read', description: 'View branding settings' },
  { module: 'branding', action: 'update', description: 'Update branding settings' },
  { module: 'campus', action: 'create', description: 'Create new campus' },
  { module: 'campus', action: 'read', description: 'View campuses' },
  { module: 'campus', action: 'update', description: 'Update campus information' },
  { module: 'campus', action: 'delete', description: 'Delete campus' },

  // Department Management
  { module: 'department', action: 'create', description: 'Create new department' },
  { module: 'department', action: 'read', description: 'View departments' },
  { module: 'department', action: 'update', description: 'Update department information' },
  { module: 'department', action: 'delete', description: 'Delete department' },
  { module: 'department', action: 'assignHOD', description: 'Assign HOD to department' },

  // User Management
  { module: 'user', action: 'create', description: 'Create new user' },
  { module: 'user', action: 'read', description: 'View users' },
  { module: 'user', action: 'update', description: 'Update user information' },
  { module: 'user', action: 'delete', description: 'Delete user' },
  { module: 'user', action: 'assignRole', description: 'Assign roles to user' },
  { module: 'user', action: 'removeRole', description: 'Remove roles from user' },
  { module: 'userRole', action: 'read', description: 'View user roles' },
  { module: 'userRole', action: 'update', description: 'Update user roles' },
  { module: 'userPermission', action: 'read', description: 'View user permissions' },
  { module: 'userPermission', action: 'grant', description: 'Grant permissions to user' },
  { module: 'userPermission', action: 'revoke', description: 'Revoke user permissions' },

  // Role Management
  { module: 'role', action: 'create', description: 'Create new role' },
  { module: 'role', action: 'read', description: 'View roles' },
  { module: 'role', action: 'update', description: 'Update role information' },
  { module: 'role', action: 'delete', description: 'Delete role' },
  { module: 'rolePermission', action: 'read', description: 'View role permissions' },
  { module: 'rolePermission', action: 'update', description: 'Update role permissions' },

  // Audit Program Management
  { module: 'auditProgram', action: 'create', description: 'Create audit program' },
  { module: 'auditProgram', action: 'read', description: 'View audit programs' },
  { module: 'auditProgram', action: 'update', description: 'Update audit program' },
  { module: 'auditProgram', action: 'delete', description: 'Delete audit program' },
  { module: 'auditProgram', action: 'approve', description: 'Approve audit program' },
  { module: 'audit', action: 'create', description: 'Create audit' },
  { module: 'audit', action: 'read', description: 'View audits' },
  { module: 'audit', action: 'update', description: 'Update audit' },
  { module: 'audit', action: 'delete', description: 'Delete audit' },
  { module: 'auditPlan', action: 'create', description: 'Create audit plan' },
  { module: 'auditPlan', action: 'read', description: 'View audit plans' },
  { module: 'auditPlan', action: 'update', description: 'Update audit plan' },
  { module: 'auditPlan', action: 'approve', description: 'Approve audit plan' },

  // Document Management
  { module: 'document', action: 'create', description: 'Create document' },
  { module: 'document', action: 'read', description: 'View documents' },
  { module: 'document', action: 'update', description: 'Update document' },
  { module: 'document', action: 'delete', description: 'Delete document' },
  { module: 'documentVersion', action: 'create', description: 'Create document version' },
  { module: 'documentVersion', action: 'read', description: 'View document versions' },
  { module: 'documentApproval', action: 'read', description: 'View document approvals' },
  { module: 'documentApproval', action: 'approve', description: 'Approve document changes' },
  { module: 'documentChangeRequest', action: 'read', description: 'View change requests' },
  { module: 'documentChangeRequest', action: 'approve', description: 'Approve change requests' },

  // Audit Execution
  { module: 'auditFinding', action: 'create', description: 'Create audit finding' },
  { module: 'auditFinding', action: 'read', description: 'View audit findings' },
  { module: 'auditFinding', action: 'update', description: 'Update audit finding' },
  { module: 'auditFinding', action: 'delete', description: 'Delete audit finding' },
  { module: 'correctiveAction', action: 'create', description: 'Create corrective action' },
  { module: 'correctiveAction', action: 'read', description: 'View corrective actions' },
  { module: 'correctiveAction', action: 'update', description: 'Update corrective action' },
  { module: 'correctiveAction', action: 'assign', description: 'Assign corrective action' },
  { module: 'checklist', action: 'create', description: 'Create checklist' },
  { module: 'checklist', action: 'read', description: 'View checklists' },
  { module: 'checklist', action: 'update', description: 'Update checklist' },
  { module: 'checklist', action: 'assign', description: 'Assign checklist' },
  { module: 'auditAnalysis', action: 'create', description: 'Create audit analysis' },
  { module: 'auditAnalysis', action: 'read', description: 'View audit analyses' },
  { module: 'auditAnalysis', action: 'update', description: 'Update audit analysis' },

  // Meeting Management
  { module: 'meeting', action: 'create', description: 'Create meeting' },
  { module: 'meeting', action: 'read', description: 'View meetings' },
  { module: 'meeting', action: 'update', description: 'Update meeting' },
  { module: 'meeting', action: 'delete', description: 'Delete meeting' },
  { module: 'meetingAttendance', action: 'read', description: 'View meeting attendance' },
  { module: 'meetingAttendance', action: 'update', description: 'Update meeting attendance' },
  { module: 'meetingAgenda', action: 'create', description: 'Create meeting agenda' },
  { module: 'meetingAgenda', action: 'read', description: 'View meeting agendas' },
  { module: 'meetingAgenda', action: 'update', description: 'Update meeting agenda' },

  // Communication & Notifications
  { module: 'message', action: 'send', description: 'Send messages' },
  { module: 'message', action: 'read', description: 'Read messages' },
  { module: 'notification', action: 'send', description: 'Send notifications' },
  { module: 'notification', action: 'read', description: 'Read notifications' },
  { module: 'feedback', action: 'read', description: 'View feedback' },
  { module: 'feedback', action: 'respond', description: 'Respond to feedback' },

  // System Administration
  { module: 'system', action: 'configure', description: 'Configure system settings' },
  { module: 'auditLog', action: 'read', description: 'View audit logs' },
  { module: 'session', action: 'manage', description: 'Manage user sessions' },
  { module: 'security', action: 'configure', description: 'Configure security settings' }
];

async function initializePermissions() {
  try {
    console.log('🚀 Starting permission initialization...');
    
    // Create all permissions
    const result = await prisma.permission.createMany({
      data: systemAdminPermissions,
      skipDuplicates: true
    });

    console.log(`✅ Successfully created ${result.count} permissions`);
    
    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true }
    });

    console.log(`📋 Found ${tenants.length} tenants`);

    // For each tenant, create a SYSTEM_ADMIN role with all permissions
    for (const tenant of tenants) {
      console.log(`🔧 Setting up permissions for tenant: ${tenant.name}`);
      
      // Get or create SYSTEM_ADMIN role
      let systemAdminRole = await prisma.role.findFirst({
        where: { 
          name: 'SYSTEM_ADMIN',
          tenantId: tenant.id
        }
      });

      if (!systemAdminRole) {
        systemAdminRole = await prisma.role.create({
          data: {
            name: 'SYSTEM_ADMIN',
            description: 'System Administrator with full access to all features',
            tenantId: tenant.id,
            roleScope: 'tenant',
            isDefault: false,
            isRemovable: false,
            loginDestination: '/admin/dashboard',
            defaultContext: 'admin'
          }
        });
        console.log(`✅ Created SYSTEM_ADMIN role for ${tenant.name}`);
      }

      // Get all permissions
      const permissions = await prisma.permission.findMany();
      
      // Create role permissions for SYSTEM_ADMIN
      const rolePermissions = permissions.map(permission => ({
        roleId: systemAdminRole.id,
        permissionId: permission.id,
        allowed: true
      }));

      await prisma.rolePermission.createMany({
        data: rolePermissions,
        skipDuplicates: true
      });

      console.log(`✅ Assigned ${permissions.length} permissions to SYSTEM_ADMIN role for ${tenant.name}`);
    }

    console.log('🎉 Permission initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
initializePermissions(); 