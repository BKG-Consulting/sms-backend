const { hasPermission } = require('../utils/permissionUtils');

function requirePermission(module, action) {
  return async (req, res, next) => {
    const userId = req.user && req.user.userId;
    const defaultRole = req.user && req.user.defaultRole;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: no user context' });
    }
    
    try {
      // WORKAROUND: Skip permission checks for SYSTEM_ADMIN users
      const isSystemAdmin = req.user?.roles?.some(role => role.name === 'SYSTEM_ADMIN') ||
                           req.user?.userRoles?.some(role => role.name === 'SYSTEM_ADMIN') ||
                           req.user?.defaultRole?.name === 'SYSTEM_ADMIN';
      
      if (isSystemAdmin) {
        console.log('[PERMISSION] SYSTEM_ADMIN detected - bypassing permission check');
        return next();
      }
      
      // Debug log
      console.log('[PERMISSION] Checking', { userId, module, action, defaultRole });
      const allowed = await hasPermission(userId, module, action, defaultRole);
      console.log('[PERMISSION] Result:', allowed);
      if (!allowed) {
        console.log('[PERMISSION] Access denied for user:', userId, 'module:', module, 'action:', action);
        return res.status(403).json({ 
          message: 'Forbidden: insufficient permissions',
          details: `User ${userId} lacks permission ${module}:${action}`
        });
      }
      next();
    } catch (err) {
      console.error('[PERMISSION] Error checking permissions:', err);
      next(err);
    }
  };
}

module.exports = { requirePermission }; 