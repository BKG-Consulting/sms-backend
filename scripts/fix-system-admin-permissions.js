const { prisma } = require('../prisma/client');
const rolePermissionService = require('../src/services/rolePermissionService');
const { logger } = require('../src/utils/logger');

/**
 * Migration script to fix permissions for existing SYSTEM_ADMIN users
 * This script will:
 * 1. Find all SYSTEM_ADMIN roles
 * 2. Remove any existing permissions (to avoid duplicates)
 * 3. Assign proper permissions based on the permission matrix
 */
async function fixSystemAdminPermissions() {
  try {
    logger.info('Starting SYSTEM_ADMIN permissions migration...');

    // 1. Find all SYSTEM_ADMIN roles
    const systemAdminRoles = await prisma.role.findMany({
      where: {
        name: 'SYSTEM_ADMIN'
      },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });

    logger.info(`Found ${systemAdminRoles.length} SYSTEM_ADMIN roles to update`);

    if (systemAdminRoles.length === 0) {
      logger.info('No SYSTEM_ADMIN roles found. Migration complete.');
      return;
    }

    // 2. Process each SYSTEM_ADMIN role
    for (const role of systemAdminRoles) {
      logger.info(`Processing SYSTEM_ADMIN role: ${role.id} for tenant: ${role.tenantId}`);

      // 3. Remove existing permissions (to avoid duplicates)
      if (role.rolePermissions.length > 0) {
        logger.info(`Removing ${role.rolePermissions.length} existing permissions for role: ${role.id}`);
        
        await prisma.rolePermission.deleteMany({
          where: {
            roleId: role.id
          }
        });
      }

      // 4. Assign proper permissions based on permission matrix
      logger.info(`Assigning permissions from matrix for role: ${role.id}`);
      
      const assignedPermissions = await rolePermissionService.assignRolePermissionsFromMatrix(
        role.id, 
        'SYSTEM_ADMIN'
      );

      logger.info(`Successfully assigned ${assignedPermissions.length} permissions to role: ${role.id}`);
    }

    logger.info('SYSTEM_ADMIN permissions migration completed successfully!');

    // 5. Verify the migration
    await verifyMigration();

  } catch (error) {
    logger.error('Error during SYSTEM_ADMIN permissions migration:', error);
    throw error;
  }
}

/**
 * Verify that the migration was successful
 */
async function verifyMigration() {
  try {
    logger.info('Verifying migration...');

    const systemAdminRoles = await prisma.role.findMany({
      where: {
        name: 'SYSTEM_ADMIN'
      },
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });

    let totalPermissions = 0;
    for (const role of systemAdminRoles) {
      totalPermissions += role.rolePermissions.length;
      logger.info(`Role ${role.id} (tenant: ${role.tenantId}) has ${role.rolePermissions.length} permissions`);
    }

    logger.info(`Migration verification complete. Total SYSTEM_ADMIN roles: ${systemAdminRoles.length}, Total permissions: ${totalPermissions}`);

    if (systemAdminRoles.length > 0 && totalPermissions === 0) {
      logger.warn('⚠️  Warning: SYSTEM_ADMIN roles found but no permissions assigned. Migration may have failed.');
    } else if (systemAdminRoles.length > 0 && totalPermissions > 0) {
      logger.info('✅ Migration verification successful! All SYSTEM_ADMIN roles have proper permissions.');
    }

  } catch (error) {
    logger.error('Error during migration verification:', error);
  }
}

/**
 * Get a summary of current SYSTEM_ADMIN permissions
 */
async function getSystemAdminSummary() {
  try {
    logger.info('Getting SYSTEM_ADMIN summary...');

    const systemAdminRoles = await prisma.role.findMany({
      where: {
        name: 'SYSTEM_ADMIN'
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true
          }
        },
        rolePermissions: {
          include: {
            permission: true
          }
        },
        userRoles: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    logger.info(`\n=== SYSTEM_ADMIN SUMMARY ===`);
    logger.info(`Total SYSTEM_ADMIN roles: ${systemAdminRoles.length}`);

    for (const role of systemAdminRoles) {
      logger.info(`\nRole ID: ${role.id}`);
      logger.info(`Tenant: ${role.tenant.name} (${role.tenant.domain})`);
      logger.info(`Permissions: ${role.rolePermissions.length}`);
      logger.info(`Users with this role: ${role.userRoles.length}`);
      
      if (role.userRoles.length > 0) {
        logger.info('Users:');
        role.userRoles.forEach(userRole => {
          const user = userRole.user;
          logger.info(`  - ${user.firstName} ${user.lastName} (${user.email})`);
        });
      }
    }

    logger.info(`\n=== END SUMMARY ===`);

  } catch (error) {
    logger.error('Error getting SYSTEM_ADMIN summary:', error);
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'migrate':
        await fixSystemAdminPermissions();
        break;
      case 'verify':
        await verifyMigration();
        break;
      case 'summary':
        await getSystemAdminSummary();
        break;
      case 'all':
        await getSystemAdminSummary();
        await fixSystemAdminPermissions();
        await verifyMigration();
        break;
      default:
        console.log(`
Usage: node fix-system-admin-permissions.js [command]

Commands:
  migrate  - Fix permissions for existing SYSTEM_ADMIN roles
  verify   - Verify that permissions are correctly assigned
  summary  - Show summary of current SYSTEM_ADMIN roles and permissions
  all      - Run summary, migrate, and verify in sequence

Example:
  node fix-system-admin-permissions.js all
        `);
    }
  } catch (error) {
    logger.error('Script execution failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = {
  fixSystemAdminPermissions,
  verifyMigration,
  getSystemAdminSummary
}; 