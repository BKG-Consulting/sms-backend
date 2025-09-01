const { Client } = require('pg');
require('dotenv').config();

// Database configuration for PostgreSQL using connection string from .env
const connectionString = process.env.DATABASE_URL || "postgresql://postgres:MmwN18cxiw62nllk5euv@database-1.c5yaai0qcvvz.eu-central-1.rds.amazonaws.com:5432/postgres";

async function verifyMRRoleCreation() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false // For RDS connections
    }
  });
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database successfully');
    
    // 1. Check all MR roles in the system
    console.log('\n=== ALL MR ROLES IN SYSTEM ===');
    const allMRRolesResult = await client.query(`
      SELECT 
        r.id, 
        r.name, 
        r."tenantId",
        t.name as "tenantName",
        r.description,
        r."isRemovable",
        r."createdAt"
      FROM "Role" r
      LEFT JOIN "Tenant" t ON r."tenantId" = t.id
      WHERE r.name = 'MR'
      ORDER BY r."createdAt" DESC
    `);
    
    const allMRRoles = allMRRolesResult.rows;
    console.log(`Found ${allMRRoles.length} MR role(s):`);
    allMRRoles.forEach(role => {
      console.log(`- Role ID: ${role.id}, Tenant: ${role.tenantName} (ID: ${role.tenantId}), Created: ${role.createdAt}`);
    });
    
    if (allMRRoles.length === 0) {
      console.log('❌ No MR roles found in the system!');
      return;
    }
    
    // 2. Get the most recent MR role (assuming it's the one just created)
    const latestMRRole = allMRRoles[0];
    console.log(`\n=== ANALYZING LATEST MR ROLE ===`);
    console.log(`Role ID: ${latestMRRole.id}`);
    console.log(`Tenant: ${latestMRRole.tenantName} (ID: ${latestMRRole.tenantId})`);
    console.log(`Description: ${latestMRRole.description}`);
    console.log(`Is Removable: ${latestMRRole.isRemovable}`);
    console.log(`Created At: ${latestMRRole.createdAt}`);
    
    // 3. Check permissions assigned to this MR role
    console.log(`\n=== PERMISSIONS FOR MR ROLE (ID: ${latestMRRole.id}) ===`);
    const rolePermissionsResult = await client.query(`
      SELECT 
        p.id as "permissionId",
        p.module,
        p.action,
        p.description as "permissionDescription",
        rp."createdAt" as "assignedAt"
      FROM "RolePermission" rp
      INNER JOIN "Permission" p ON rp."permissionId" = p.id
      WHERE rp."roleId" = $1
      ORDER BY p.module, p.action
    `, [latestMRRole.id]);
    
    const rolePermissions = rolePermissionsResult.rows;
    console.log(`Found ${rolePermissions.length} permission(s) assigned to MR role:`);
    
    if (rolePermissions.length === 0) {
      console.log('❌ No permissions assigned to MR role!');
    } else {
      // Group permissions by module
      const permissionsByModule = {};
      rolePermissions.forEach(perm => {
        if (!permissionsByModule[perm.module]) {
          permissionsByModule[perm.module] = [];
        }
        permissionsByModule[perm.module].push(perm);
      });
      
      Object.keys(permissionsByModule).forEach(module => {
        console.log(`\n  📁 ${module}:`);
        permissionsByModule[module].forEach(perm => {
          console.log(`    ✓ ${perm.action} - ${perm.permissionDescription || 'No description'}`);
        });
      });
    }
    
    // 4. Check if there are any users assigned to this MR role
    console.log(`\n=== USERS ASSIGNED TO MR ROLE ===`);
    const usersWithMRRoleResult = await client.query(`
      SELECT 
        u.id as "userId",
        u."firstName",
        u."lastName",
        u.email,
        ur."createdAt" as "roleAssignedAt"
      FROM "UserRole" ur
      INNER JOIN "User" u ON ur."userId" = u.id
      WHERE ur."roleId" = $1
    `, [latestMRRole.id]);
    
    const usersWithMRRole = usersWithMRRoleResult.rows;
    console.log(`Found ${usersWithMRRole.length} user(s) assigned to MR role:`);
    usersWithMRRole.forEach(user => {
      console.log(`- ${user.firstName} ${user.lastName} (${user.email}) - Assigned: ${user.roleAssignedAt}`);
    });
    
    // 5. Verify tenant isolation - check if other tenants have MR roles
    console.log(`\n=== TENANT ISOLATION CHECK ===`);
    const otherTenantMRRoles = allMRRoles.filter(role => role.tenantId !== latestMRRole.tenantId);
    
    if (otherTenantMRRoles.length > 0) {
      console.log('⚠️  Other tenants also have MR roles:');
      otherTenantMRRoles.forEach(role => {
        console.log(`- Tenant: ${role.tenantName} (ID: ${role.tenantId})`);
      });
    } else {
      console.log('✅ Only the current tenant has an MR role - proper isolation maintained');
    }
    
    // 6. Check predefined MR role permissions template
    console.log(`\n=== PREDEFINED MR ROLE TEMPLATE CHECK ===`);
    
    // Expected MR permissions based on common audit office structure (module.action format)
    const expectedMRPermissions = [
      'audit_programs.view',
      'audit_programs.create', 
      'audit_programs.edit',
      'audit_programs.approve',
      'planning_meetings.view',
      'planning_meetings.create',
      'planning_meetings.edit',
      'audit_teams.view',
      'audit_teams.manage',
      'reports.view',
      'reports.create',
      'reports.edit'
    ];
    
    const assignedPermissionNames = rolePermissions.map(p => `${p.module}.${p.action}`);
    const missingPermissions = expectedMRPermissions.filter(perm => 
      !assignedPermissionNames.includes(perm)
    );
    
    console.log(`\nActual permissions assigned: ${assignedPermissionNames.join(', ')}`);
    
    if (missingPermissions.length > 0) {
      console.log('⚠️  Some expected MR permissions may be missing:');
      missingPermissions.forEach(perm => {
        console.log(`  - ${perm}`);
      });
    } else {
      console.log('✅ All expected MR permissions appear to be assigned');
    }
    
    // Summary
    console.log(`\n=== SUMMARY ===`);
    console.log(`✅ MR role exists for tenant: ${latestMRRole.tenantName}`);
    console.log(`✅ Role has ${rolePermissions.length} permissions assigned`);
    console.log(`✅ ${usersWithMRRole.length} users assigned to MR role`);
    
    if (allMRRoles.length === 1) {
      console.log('✅ Only one MR role exists in the system (proper uniqueness)');
    } else {
      console.log(`⚠️  ${allMRRoles.length} MR roles exist across different tenants`);
    }
    
  } catch (error) {
    console.error('Error verifying MR role creation:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
    console.log('\nDatabase connection closed');
  }
}

// Run the verification
verifyMRRoleCreation();
