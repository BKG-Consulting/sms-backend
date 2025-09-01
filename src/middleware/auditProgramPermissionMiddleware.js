/**
 * Audit Program Domain Permission Middleware
 * 
 * This middleware provides granular permission checks for all audit program operations.
 * It uses the new domain-specific permission structure.
 */

const { hasPermission } = require('../utils/permissionUtils');
const { logger } = require('../utils/logger.util');

// Core CRUD Operations
const requireAuditProgramCreatePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:create');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:create', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to create audit programs',
        requiredPermission: 'auditProgram:create'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:create permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramReadPermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:read');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:read', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to view audit programs',
        requiredPermission: 'auditProgram:read'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:read permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramUpdatePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:update');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:update', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to update audit programs',
        requiredPermission: 'auditProgram:update'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:update permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramDeletePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:delete');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:delete', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to delete audit programs',
        requiredPermission: 'auditProgram:delete'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:delete permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

// Workflow Operations
const requireAuditProgramCommitPermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:create');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:create (commit)', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to submit audit programs',
        requiredPermission: 'auditProgram:create'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:create permission (commit):', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramApprovePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:approve');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:approve', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to approve audit programs',
        requiredPermission: 'auditProgram:approve'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:approve permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramRejectPermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:approve');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:approve (for rejection)', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to approve/reject audit programs',
        requiredPermission: 'auditProgram:approve'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:approve permission (for rejection):', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

// Advanced Operations
const requireAuditProgramExportPermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:export');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:export', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to export audit program data',
        requiredPermission: 'auditProgram:export'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:export permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramManagePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:manage');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:manage', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to manage audit programs',
        requiredPermission: 'auditProgram:manage'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:manage permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

// Audit Management within Programs
const requireAuditProgramAuditCreatePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:audit:create');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:audit:create', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to create audits within programs',
        requiredPermission: 'auditProgram:audit:create'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:audit:create permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramAuditReadPermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:audit:read');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:audit:read', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to view audits within programs',
        requiredPermission: 'auditProgram:audit:read'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:audit:read permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramAuditUpdatePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:audit:update');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:audit:update', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to update audits within programs',
        requiredPermission: 'auditProgram:audit:update'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:audit:update permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramAuditDeletePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:audit:delete');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:audit:delete', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to delete audits within programs',
        requiredPermission: 'auditProgram:audit:delete'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:audit:delete permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

// Team Management
const requireAuditProgramTeamManagePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:team:manage');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:team:manage', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to manage audit teams',
        requiredPermission: 'auditProgram:team:manage'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:team:manage permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

// Meeting Management
const requireAuditProgramMeetingCreatePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:meeting:create');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:meeting:create', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to create planning meetings',
        requiredPermission: 'auditProgram:meeting:create'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:meeting:create permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramMeetingReadPermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:meeting:read');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:meeting:read', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to view planning meetings',
        requiredPermission: 'auditProgram:meeting:read'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:meeting:read permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramMeetingUpdatePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:meeting:update');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:meeting:update', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to update planning meetings',
        requiredPermission: 'auditProgram:meeting:update'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:meeting:update permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

const requireAuditProgramMeetingDeletePermission = async (req, res, next) => {
  try {
    const hasAccess = await hasPermission(req.user, 'auditProgram:meeting:delete');
    if (!hasAccess) {
      logger.warn('Permission denied: auditProgram:meeting:delete', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId
      });
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have permission to delete planning meetings',
        requiredPermission: 'auditProgram:meeting:delete'
      });
    }
    next();
  } catch (error) {
    logger.error('Error checking auditProgram:meeting:delete permission:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking permissions'
    });
  }
};

// Utility function to check multiple permissions
const requireAnyAuditProgramPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      for (const permission of permissions) {
        const hasAccess = await hasPermission(req.user, permission);
        if (hasAccess) {
          return next();
        }
      }
      
      logger.warn('Permission denied: none of the required permissions found', {
        userId: req.user.id,
        userRoles: req.user.roles,
        tenantId: req.user.tenantId,
        requiredPermissions: permissions
      });
      
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You do not have any of the required permissions',
        requiredPermissions: permissions
      });
    } catch (error) {
      logger.error('Error checking multiple audit program permissions:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Error checking permissions'
      });
    }
  };
};

// Utility function to check all permissions
const requireAllAuditProgramPermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      for (const permission of permissions) {
        const hasAccess = await hasPermission(req.user, permission);
        if (!hasAccess) {
          logger.warn('Permission denied: missing required permission', {
            userId: req.user.id,
            userRoles: req.user.roles,
            tenantId: req.user.tenantId,
            missingPermission: permission,
            requiredPermissions: permissions
          });
          
          return res.status(403).json({
            error: 'Permission denied',
            message: `You do not have the required permission: ${permission}`,
            missingPermission: permission,
            requiredPermissions: permissions
          });
        }
      }
      next();
    } catch (error) {
      logger.error('Error checking all audit program permissions:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Error checking permissions'
      });
    }
  };
};

module.exports = {
  // Core CRUD Operations
  requireAuditProgramCreatePermission,
  requireAuditProgramReadPermission,
  requireAuditProgramUpdatePermission,
  requireAuditProgramDeletePermission,
  
  // Workflow Operations
  requireAuditProgramCommitPermission,
  requireAuditProgramApprovePermission,
  requireAuditProgramRejectPermission,
  
  // Advanced Operations
  requireAuditProgramExportPermission,
  requireAuditProgramManagePermission,
  
  // Audit Management within Programs
  requireAuditProgramAuditCreatePermission,
  requireAuditProgramAuditReadPermission,
  requireAuditProgramAuditUpdatePermission,
  requireAuditProgramAuditDeletePermission,
  
  // Team Management
  requireAuditProgramTeamManagePermission,
  
  // Meeting Management
  requireAuditProgramMeetingCreatePermission,
  requireAuditProgramMeetingReadPermission,
  requireAuditProgramMeetingUpdatePermission,
  requireAuditProgramMeetingDeletePermission,
  
  // Utility Functions
  requireAnyAuditProgramPermission,
  requireAllAuditProgramPermissions
}; 
 
 