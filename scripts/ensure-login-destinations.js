const { prisma } = require('../prisma/client');
const { logger } = require('../src/utils/logger');

// Define the mapping of role names to their default login destinations
const ROLE_LOGIN_DESTINATIONS = {
  'SUPER_ADMIN': '/admin',
  'SYSTEM_ADMIN': '/system_admin',
  'ADMIN': '/dashboard',
  'PRINCIPAL': '/system_admin',
  'HOD': '/system_admin',
  'HOD_AUDITOR': '/system_admin',
  'AUDITOR': '/auditors',
  'MR': '/mr',
  'STAFF': '/dashboard',
  'USER': '/dashboard',
  'TEAM_LEADER': '/dashboard' // Added TEAM_LEADER role
};

async function ensureLoginDestinations() {
  try {
    logger.info('Starting loginDestination migration for all roles...');
    
    // Get all roles first
    const allRoles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        tenantId: true,
        loginDestination: true
      }
    });
    
    logger.info(`Found ${allRoles.length} total roles`);
    
    // Filter roles that need updates
    const rolesToUpdate = allRoles.filter(role => {
      const expectedDestination = ROLE_LOGIN_DESTINATIONS[role.name.toUpperCase()];
      return !expectedDestination || 
             !role.loginDestination || 
             role.loginDestination === '' ||
             role.loginDestination === '/dashboard';
    });
    
    logger.info(`Found ${rolesToUpdate.length} roles that need loginDestination updates`);
    
    if (rolesToUpdate.length === 0) {
      logger.info('All roles already have proper loginDestination values');
      return;
    }
    
    // Update roles with appropriate loginDestination based on role name
    const updatePromises = rolesToUpdate.map(role => {
      const destination = ROLE_LOGIN_DESTINATIONS[role.name.toUpperCase()] || '/dashboard';
      
      logger.info(`Updating role ${role.name} (${role.id}) from "${role.loginDestination || 'null'}" to "${destination}"`);
      
      return prisma.role.update({
        where: { id: role.id },
        data: { loginDestination: destination }
      });
    });
    
    await Promise.all(updatePromises);
    
    logger.info(`Successfully updated ${rolesToUpdate.length} roles with proper loginDestination values`);
    
    // Log summary of changes
    logger.info('Summary of loginDestination updates:');
    for (const role of rolesToUpdate) {
      const newDestination = ROLE_LOGIN_DESTINATIONS[role.name.toUpperCase()] || '/dashboard';
      logger.info(`  ${role.name}: ${role.loginDestination || 'null'} → ${newDestination}`);
    }
    
  } catch (error) {
    logger.error('Error ensuring loginDestinations:', error);
    throw error;
  }
}

// Function to check current loginDestination status
async function checkLoginDestinationStatus() {
  try {
    logger.info('Checking current loginDestination status...');
    
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        tenantId: true,
        loginDestination: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    logger.info(`Found ${roles.length} total roles`);
    
    // Group by loginDestination
    const destinationGroups = {};
    roles.forEach(role => {
      const dest = role.loginDestination || 'null';
      if (!destinationGroups[dest]) {
        destinationGroups[dest] = [];
      }
      destinationGroups[dest].push(role);
    });
    
    logger.info('Current loginDestination distribution:');
    Object.entries(destinationGroups).forEach(([destination, roleList]) => {
      logger.info(`  ${destination}: ${roleList.length} roles`);
      roleList.forEach(role => {
        logger.info(`    - ${role.name} (${role.id})`);
      });
    });
    
    // Check for roles that might need updates
    const needsUpdate = roles.filter(role => 
      !role.loginDestination || 
      role.loginDestination === '' ||
      !ROLE_LOGIN_DESTINATIONS[role.name.toUpperCase()]
    );
    
    if (needsUpdate.length > 0) {
      logger.warn(`${needsUpdate.length} roles may need loginDestination updates:`);
      needsUpdate.forEach(role => {
        logger.warn(`  - ${role.name}: current="${role.loginDestination || 'null'}", expected="${ROLE_LOGIN_DESTINATIONS[role.name.toUpperCase()] || 'unknown'}"`);
      });
    } else {
      logger.info('All roles have appropriate loginDestination values');
    }
    
  } catch (error) {
    logger.error('Error checking loginDestination status:', error);
    throw error;
  }
}

// Run the migration if called directly
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'check') {
    checkLoginDestinationStatus()
      .then(() => {
        logger.info('LoginDestination status check completed');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('LoginDestination status check failed:', error);
        process.exit(1);
      });
  } else {
    ensureLoginDestinations()
      .then(() => {
        logger.info('LoginDestination migration completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        logger.error('LoginDestination migration failed:', error);
        process.exit(1);
      });
  }
}

module.exports = { ensureLoginDestinations, checkLoginDestinationStatus }; 