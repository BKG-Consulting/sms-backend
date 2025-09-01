const { prisma } = require('../prisma/client');
const { logger } = require('../src/utils/logger');

async function fixSystemAdminLoginDestinations() {
  try {
    logger.info('Starting SYSTEM_ADMIN loginDestination migration...');
    
    // Find all SYSTEM_ADMIN roles with wrong loginDestination
    const systemAdminRoles = await prisma.role.findMany({
      where: {
        name: 'SYSTEM_ADMIN',
        loginDestination: '/dashboard' // Find roles with wrong destination
      },
      select: {
        id: true,
        name: true,
        tenantId: true,
        loginDestination: true
      }
    });
    
    logger.info(`Found ${systemAdminRoles.length} SYSTEM_ADMIN roles with wrong loginDestination`);
    
    if (systemAdminRoles.length === 0) {
      logger.info('No SYSTEM_ADMIN roles need fixing');
      return;
    }
    
    // Update all SYSTEM_ADMIN roles to have correct loginDestination
    const updatePromises = systemAdminRoles.map(role => 
      prisma.role.update({
        where: { id: role.id },
        data: { loginDestination: '/system_admin' }
      })
    );
    
    await Promise.all(updatePromises);
    
    logger.info(`Successfully updated ${systemAdminRoles.length} SYSTEM_ADMIN roles to use /system_admin loginDestination`);
    
    // Log the changes
    for (const role of systemAdminRoles) {
      logger.info(`Updated SYSTEM_ADMIN role`, {
        roleId: role.id,
        tenantId: role.tenantId,
        oldDestination: role.loginDestination,
        newDestination: '/system_admin'
      });
    }
    
  } catch (error) {
    logger.error('Error fixing SYSTEM_ADMIN loginDestinations:', error);
    throw error;
  }
}

// Run the migration if called directly
if (require.main === module) {
  fixSystemAdminLoginDestinations()
    .then(() => {
      logger.info('SYSTEM_ADMIN loginDestination migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('SYSTEM_ADMIN loginDestination migration failed:', error);
      process.exit(1);
    });
}

module.exports = { fixSystemAdminLoginDestinations }; 