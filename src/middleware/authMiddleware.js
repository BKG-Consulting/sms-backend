const jwt = require('jsonwebtoken');
const sessionService = require('../services/sessionService');
const { logger } = require('../utils/logger');
const { hasPermission } = require('../utils/permissionUtils');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
  if (!token) {
    logger.error('No access token provided');
    return res.status(401).json({ error: { message: 'No access token provided', code: 'NO_TOKEN' } });
  }
  try {
    // First verify JWT token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    logger.debug('Decoded token:', decoded);

    // Then validate session
    const session = await sessionService.validateSession(token);
    if (!session) {
      logger.warn('Session not found or expired', { userId: decoded.userId });
      return res.status(401).json({ error: { message: 'Session expired or invalid', code: 'SESSION_EXPIRED' } });
    }

    req.user = {
      userId: decoded.userId,
      roleNames: decoded.roleNames || [],
      roles: decoded.roles || [],
      departments: decoded.departments || [],
      tenantId: decoded.tenantId,
      primaryRole: decoded.primaryRole || null,
      primaryDepartment: decoded.primaryDepartment || null,
      userRoles: decoded.userRoles || [],
      defaultRole: decoded.defaultRole || null,
    };
    req.session = session;
    next();
  } catch (error) {
    logger.error('Invalid access token', { error: error.message });
    return res.status(401).json({ error: { message: 'Invalid access token', code: 'INVALID_TOKEN' } });
  }
};

// Middleware to restrict access based on user roles
const restrictTo = (...roles) => {
  const flatRoles = roles.flat().map(r => r.toLowerCase().trim());
  return (req, res, next) => {
    logger.debug('Checking user roles', { 
      userRoles: req.user?.roles, 
      roleNames: req.user?.roleNames,
      userRolesArray: req.user?.userRoles,
      requiredRoles: flatRoles 
    });
    logger.debug('User roles array:', req.user?.roles);
    logger.debug('User userRoles array:', req.user?.userRoles);
    
    // Check roleNames array (from JWT token)
    const hasRoleName = req.user?.roleNames && req.user.roleNames.some(roleName =>
      flatRoles.includes(roleName.toLowerCase().trim())
    );
    
    // Check department/advanced roles
    const hasAdvancedRole = req.user?.roles && req.user.roles.some(roleObj =>
      roleObj && roleObj.name && flatRoles.includes(roleObj.name.toLowerCase().trim())
    );
    // Check global userRoles (if present)
    const hasGlobalRole = req.user?.userRoles && req.user.userRoles.some(roleObj => {
      const roleName = roleObj?.name?.toLowerCase().trim();
      const hasRole = flatRoles.includes(roleName);
      logger.debug('Checking userRole:', { roleName, hasRole, flatRoles });
      return hasRole;
    });
    // Check defaultRole (if present)
    const hasDefaultRole = req.user?.defaultRole && req.user.defaultRole.name && flatRoles.includes(req.user.defaultRole.name.toLowerCase().trim());
    
    if (!hasRoleName && !hasAdvancedRole && !hasGlobalRole && !hasDefaultRole) {
      logger.warn('Access denied for user', { 
        userId: req.user?.userId, 
        roles: req.user?.roles, 
        roleNames: req.user?.roleNames,
        userRoles: req.user?.userRoles, 
        defaultRole: req.user?.defaultRole 
      });
      return res.status(403).json({ error: { message: 'Access denied', code: 'FORBIDDEN', requiredRoles: flatRoles } });
    }
    next();
  };
};

/**
 * Middleware to require a specific permission for a route.
 * Usage: router.post('/route', requirePermission('module', 'action'), handler)
 */
function requirePermission(module, action) {
  return async (req, res, next) => {
    try {
      const userId = req.user && req.user.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized: no user context' });
      }
      // Pass full user object for permission checks
      const allowed = await hasPermission(req.user, `${module}:${action}`);
      if (!allowed) {
        return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { authenticateToken, restrictTo, requirePermission };