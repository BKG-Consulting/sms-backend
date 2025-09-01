const express = require('express');
const { authenticateToken, restrictTo } = require('../middleware/authMiddleware');
const router = express.Router();

// Test route to verify role-based access
router.get('/test-roles', authenticateToken, restrictTo(['SYSTEM_ADMIN', 'MR']), (req, res) => {
  res.json({
    message: 'Role-based access working correctly',
    user: {
      userId: req.user.userId,
      roleNames: req.user.roleNames,
      roles: req.user.roles,
      userRoles: req.user.userRoles,
      defaultRole: req.user.defaultRole
    }
  });
});

// Test route for MR only
router.get('/test-mr-only', authenticateToken, restrictTo(['MR']), (req, res) => {
  res.json({
    message: 'MR-only access working correctly',
    user: {
      userId: req.user.userId,
      roleNames: req.user.roleNames
    }
  });
});

module.exports = router; 