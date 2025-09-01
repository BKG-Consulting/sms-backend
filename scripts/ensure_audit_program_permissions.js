#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { getRolePermissions, getFlattenedPermissions } = require('../constants/rolePermissions');

const prisma = new PrismaClient();

// Define the audit program permissions that should exist
const AUDIT_PROGRAM_PERMISSIONS = [
  { module: 'auditProgram', action: 'create', description: 'Create new audit programs' },
  { module: 'auditProgram', action: 'read', description: 'View audit programs' },
  { module: 'auditProgram', action: 'update', description: 'Update audit program details' },
  { module: 'auditProgram', action: 'delete', description: 'Delete audit programs' },
  { module: 'auditProgram', action: 'submit', description: 'Submit audit programs for approval' },
  { module: 'auditProgram', action: 'approve', description: 'Approve or reject audit programs' },
  { module: 'auditProgram', action: 'review', description: 'Review audit program details' },
  { module: 'auditProgram', action: 'publish', description: 'Publish approved audit programs' },
  { module: 'auditProgram', action: 'export', description: 'Export audit program data' },
  { module: 'auditProgram', action: 'manage', description: 'Manage all audit program operations' },
];

async function ensureAuditProgramPermissions() {
  console.log('🔍 Checking for audit program permissions...');
  
  try {
    // Check which permissions already exist
    const existingPermissions = await prisma.permission.findMany({
      where: {
        module: 'auditProgram'
      }
    });
    
    console.log(`Found ${existingPermissions.length} existing audit program permissions`);
    
    // Create missing permissions
    const permissionsToCreate = [];
    for (const perm of AUDIT_PROGRAM_PERMISSIONS) {
      const exists = existingPermissions.find(p => p.module === perm.module && p.action === perm.action);
      if (!exists) {
        permissionsToCreate.push(perm);
      }
    }
    
    if (permissionsToCreate.length > 0) {
      console.log(`Creating ${permissionsToCreate.length} missing permissions...`);
      
      const createdPermissions = await prisma.permission.createMany({
        data: permissionsToCreate,
        skipDuplicates: true
      });
      
      console.log(`✅ Created ${createdPermissions.count} new permissions`);
    } else {
      console.log('✅ All audit program permissions already exist');
    }
    
    // Now ensure all roles have the correct permissions assigned
    console.log('🔍 Checking role permission assignments...');
    
    const allRoles = await prisma.role.findMany({
      where: {
        name: {
          in: ['SYSTEM_ADMIN', 'SUPER_ADMIN', 'MR', 'PRINCIPAL', 'AUDITOR', 'STAFF']
        }
      }
    });
    
    for (const role of allRoles) {
      console.log(`Processing role: ${role.name}`);
      
      // Get the permissions this role should have according to the matrix
      const rolePermissions = getFlattenedPermissions(role.name);
      const auditProgramPermissions = rolePermissions.filter(p => p.module === 'auditProgram');
      
      if (auditProgramPermissions.length > 0) {
        console.log(`  Role ${role.name} should have ${auditProgramPermissions.length} audit program permissions`);
        
        // Get the permission IDs for these permissions
        const permissionIds = [];
        for (const perm of auditProgramPermissions) {
          const permission = await prisma.permission.findFirst({
            where: {
              module: perm.module,
              action: perm.action
            }
          });
          
          if (permission) {
            permissionIds.push(permission.id);
          }
        }
        
        // Assign permissions to role
        for (const permissionId of permissionIds) {
          await prisma.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: role.id,
                permissionId: permissionId
              }
            },
            update: {
              allowed: true
            },
            create: {
              roleId: role.id,
              permissionId: permissionId,
              allowed: true
            }
          });
        }
        
        console.log(`  ✅ Assigned ${permissionIds.length} permissions to ${role.name}`);
      }
    }
    
    console.log('✅ Audit program permissions setup complete!');
    
  } catch (error) {
    console.error('❌ Error ensuring audit program permissions:', error);
    throw error;
  }
}

// Run the script
if (require.main === module) {
  ensureAuditProgramPermissions()
    .then(() => {
      console.log('🎉 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { ensureAuditProgramPermissions }; 