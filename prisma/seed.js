require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = new PrismaClient();

async function seedSuperAdmins() {
  console.log('Seeding auth-service database with Super Admins...');

  const defaultTenant = {
    id: 'default-tenant',
    name: 'Default Tenant',
    domain: 'default.local',
    email: 'default@institution.com',
    type: 'UNIVERSITY', // must match your enum in the schema
    status: 'ACTIVE', // Ensure tenant is active
    createdBy: 'system',
  };

  // Step 1: Create default tenant if not exists
  try {
    const tenant = await prisma.tenant.upsert({
      where: { id: defaultTenant.id },
      update: {}, // No update needed if tenant already exists
      create: defaultTenant,
    });
    console.log(`✅ Tenant ensured with ID: ${tenant.id}`);
  } catch (e) {
    console.error('❌ Error ensuring tenant:', e);
    throw e;
  }

  // Step 2: Seed roles for the default tenant
  const roles = [
    { name: 'SUPER_ADMIN', description: 'Top-level admin with full system access', tenant: { connect: { id: defaultTenant.id } } },
    { name: 'SYSTEM_ADMIN', description: 'System administrator with full tenant management permissions', tenant: { connect: { id: defaultTenant.id } } },
    { name: 'ADMIN', description: 'Admin role for tenant management', tenant: { connect: { id: defaultTenant.id } } },
    { name: 'MR', description: 'Management Representative for audit management', tenant: { connect: { id: defaultTenant.id } } },
    { name: 'PRINCIPAL', description: 'Principal for audit approval', tenant: { connect: { id: defaultTenant.id } } },
    { name: 'AUDITOR', description: 'Auditor for conducting audits', tenant: { connect: { id: defaultTenant.id } } },
    { name: 'TEAM_LEADER', description: 'Team Leader for audit teams', tenant: { connect: { id: defaultTenant.id } } },
  ];

  const createdRoles = {};
  for (const role of roles) {
    const roleId = `${defaultTenant.id}-${role.name.toLowerCase()}`;
    try {
      const createdRole = await prisma.role.upsert({
        where: { id: roleId },
        update: {}, // No update needed for existing role
        create: {
          id: roleId,
          name: role.name,
          description: role.description,
          tenant: { connect: { id: defaultTenant.id } },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      createdRoles[role.name] = createdRole;
      console.log(`✅ Role ${role.name} seeded with ID: ${createdRole.id}`);
    } catch (e) {
      console.error(`❌ Error seeding role ${role.name}:`, e);
      throw e;
    }
  }

  const superAdmins = [
    {
      id: uuidv4(),
      email: 'info@dualdimension.org',
      password: 'pass1234',
      verified: true,
      tenantId: defaultTenant.id,
      firstName: 'Super',
      lastName: 'Admin',
      createdBy: 'system',
      roleType: 'SUPER_ADMIN',
    },
    {
      id: uuidv4(),
      email: 'system@dualdimension.org',
      password: 'pass1234',
      verified: true,
      tenantId: defaultTenant.id,
      firstName: 'System',
      lastName: 'Admin',
      createdBy: 'system',
      roleType: 'SYSTEM_ADMIN',
    },
  ];

  for (const superAdmin of superAdmins) {
    try {
      const hashedPassword = await bcrypt.hash(superAdmin.password, 10);
      const createdSuperAdmin = await prisma.user.upsert({
        where: { email: superAdmin.email },
        update: {
          password: hashedPassword,
          verified: true,
          firstName: superAdmin.firstName,
          lastName: superAdmin.lastName,
        },
        create: {
          id: superAdmin.id,
          email: superAdmin.email,
          password: hashedPassword,
          verified: superAdmin.verified,
          tenant: { connect: { id: superAdmin.tenantId } },
          firstName: superAdmin.firstName,
          lastName: superAdmin.lastName,
          createdBy: superAdmin.createdBy,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Assign the appropriate role
      const roleType = superAdmin.roleType || 'SUPER_ADMIN';
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: createdSuperAdmin.id,
            roleId: createdRoles[roleType].id,
          },
        },
        update: {}, // No update needed if user-role already exists
        create: {
          userId: createdSuperAdmin.id,
          roleId: createdRoles[roleType].id,
          createdAt: new Date(),
        },
      });

      // Ensure admin has a global UserDepartmentRole for frontend compatibility
      const existingUDR = await prisma.userDepartmentRole.findFirst({
        where: {
          userId: createdSuperAdmin.id,
          departmentId: null,
          roleId: createdRoles[roleType].id,
        }
      });
      if (!existingUDR) {
        await prisma.userDepartmentRole.create({
          data: {
            userId: createdSuperAdmin.id,
            departmentId: null,
            roleId: createdRoles[roleType].id,
            isPrimaryRole: true,
            isPrimaryDepartment: false,
          }
        });
      }

      console.log(`✅ Admin seeded: ${createdSuperAdmin.email} with role ${roleType} (ID: ${createdSuperAdmin.id})`);
    } catch (e) {
      console.error('❌ Error seeding Admin:', e);
      throw e;
    }
  }
}

// --- COMPREHENSIVE PERMISSION SEEDING ---
async function seedComprehensivePermissions() {
  console.log('🌐 Seeding comprehensive permission matrix...');

  // Define all System Admin permissions based on our domain approach
  const systemAdminPermissions = [
    // Tenant Management
    { module: 'tenant', action: 'create', description: 'Create new tenant' },
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

  // Create all permissions
  console.log('📝 Creating permissions...');
  const createdPermissions = {};
  for (const perm of systemAdminPermissions) {
    try {
    const created = await prisma.permission.upsert({
        where: { 
          module_action: { 
            module: perm.module, 
            action: perm.action 
          } 
        },
        update: { description: perm.description }, // Update description if exists
      create: perm,
    });
      createdPermissions[`${perm.module}:${perm.action}`] = created;
      console.log(`✅ Permission: ${perm.module}:${perm.action}`);
    } catch (error) {
      console.error(`❌ Error creating permission ${perm.module}:${perm.action}:`, error);
    }
  }

  console.log(`✅ Created ${Object.keys(createdPermissions).length} permissions`);

  // Get all roles and assign permissions
  const roles = await prisma.role.findMany();
  console.log(`🔧 Assigning permissions to ${roles.length} roles...`);
  
  for (const role of roles) {
    try {
      let permissionsToAssign = [];

      // Define role-specific permissions
      switch (role.name) {
        case 'SUPER_ADMIN':
        case 'SYSTEM_ADMIN':
          // Full access to everything
          permissionsToAssign = Object.keys(createdPermissions);
          break;
        
        case 'ADMIN':
          // Most permissions except system-level ones
          permissionsToAssign = Object.keys(createdPermissions).filter(key => 
            !key.startsWith('system:') && 
            !key.startsWith('auditLog:') && 
            !key.startsWith('session:') && 
            !key.startsWith('security:')
          );
          break;
        
        case 'MR':
          // Management Representative permissions
          permissionsToAssign = Object.keys(createdPermissions).filter(key => 
            key.includes('audit') || 
            key.includes('document') || 
            key.includes('meeting') ||
            key.includes('notification') ||
            key.includes('feedback')
          );
          break;
        
        case 'PRINCIPAL':
          // Principal permissions - audit approval focus
          permissionsToAssign = Object.keys(createdPermissions).filter(key => 
            key.includes('audit') && key.includes('approve') ||
            key.includes('auditProgram') ||
            key.includes('auditPlan') ||
            key.includes('document') && key.includes('approve')
          );
          break;
        
        case 'AUDITOR':
          // Auditor permissions
          permissionsToAssign = Object.keys(createdPermissions).filter(key => 
            key.includes('audit') ||
            key.includes('finding') ||
            key.includes('checklist') ||
            key.includes('correctiveAction') ||
            key.includes('document') && !key.includes('approve')
          );
          break;
        
        case 'TEAM_LEADER':
          // Team Leader permissions
          permissionsToAssign = Object.keys(createdPermissions).filter(key => 
            key.includes('audit') ||
            key.includes('team') ||
            key.includes('meeting') ||
            key.includes('checklist')
          );
          break;
        
        default:
          // Default minimal permissions
          permissionsToAssign = Object.keys(createdPermissions).filter(key => 
            key.includes('read') || key.includes('view')
          );
      }

      // Assign permissions to role
      for (const permissionKey of permissionsToAssign) {
        const permission = createdPermissions[permissionKey];
        if (permission) {
          await prisma.rolePermission.upsert({
            where: { 
              roleId_permissionId: { 
                roleId: role.id, 
                permissionId: permission.id 
              } 
            },
            update: { allowed: true },
            create: {
              roleId: role.id,
              permissionId: permission.id,
              allowed: true,
            },
          });
        }
      }
      
      console.log(`✅ ${role.name}: Assigned ${permissionsToAssign.length} permissions`);
    } catch (error) {
      console.error(`❌ Error assigning permissions to role ${role.name}:`, error);
    }
  }

  console.log('🎉 Comprehensive permission seeding completed!');
}

// Run seeding
seedSuperAdmins()
  .then(seedComprehensivePermissions)
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Prisma disconnected');
  });
