const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, restrictTo } = require('../middleware/authMiddleware');
const { prisma } = require('../../prisma/client');
const logger = require('../utils/logger');

router.get('/me', authenticateToken, userController.me);
router.get('/users/:id', userController.getUserById);
router.post('/delete-account', authenticateToken, userController.deleteAccount);
router.get('/users-by-role-tenant', authenticateToken, userController.getUsersByRoleAndTenant);
router.get('/users/hods', authenticateToken, userController.getHods); // Add HODs endpoint

// New route for fetching HODs
router.get('/hods', authenticateToken, userController.getHODs);

// New route for fetching all department heads (HODs and HOD AUDITORs)
router.get('/department-heads', authenticateToken, userController.getDepartmentHeads);

// New route for super admin to get all users
router.get('/all', authenticateToken, restrictTo(['SUPER_ADMIN']), userController.getAllUsers);

// New route for system admin to get users for their tenant
router.get('/tenant-users', authenticateToken, restrictTo(['SYSTEM_ADMIN']), userController.getUsersForTenant);

// New routes for institution management
router.post('/users', authenticateToken, restrictTo(['SYSTEM_ADMIN']), userController.createUser);
router.put('/users/:id', authenticateToken, restrictTo(['SYSTEM_ADMIN']), userController.updateUser);
router.put('/users/:id/comprehensive-update', authenticateToken, restrictTo(['SYSTEM_ADMIN']), userController.updateUserComprehensive);
router.delete('/users/:id', authenticateToken, restrictTo(['SYSTEM_ADMIN']), userController.deleteUser);
router.patch('/users/:id/default-role', authenticateToken, restrictTo(['SYSTEM_ADMIN']), userController.setDefaultRole);

// Route for users to update their own profile
router.put('/profile', authenticateToken, userController.updateProfile);

// Route for users to change their password
router.put('/change-password', authenticateToken, userController.changePassword);

// Route for users to set their own default role
router.post('/set-default-role', authenticateToken, userController.setDefaultRole);

// Route for fetching users with specific permissions
router.get('/with-permission', authenticateToken, userController.getUsersWithPermission);

// Get eligible attendees for meetings
router.get('/eligible-attendees', authenticateToken, async (req, res, next) => {
  try {
    const { meetingType, auditId } = req.query;
    const { tenantId } = req.user;

    if (!meetingType || !auditId) {
      return res.status(400).json({
        message: 'Missing required parameters: meetingType, auditId',
        error: 'Missing parameters'
      });
    }

    let eligibleAttendees = [];

    if (meetingType === 'PLANNING') {
      // For planning meetings, get audit team members
      const audit = await prisma.audit.findUnique({
        where: { id: auditId },
        include: {
          teamMembers: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      });

      if (audit) {
        eligibleAttendees = audit.teamMembers.map(member => ({
          id: member.user.id,
          firstName: member.user.firstName,
          lastName: member.user.lastName,
          email: member.user.email
        }));
      }
    } else if (meetingType === 'OPENING' || meetingType === 'CLOSING') {
      // For opening/closing meetings, get users with AUDITOR role
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          userRoles: {
            some: {
              role: {
                name: 'AUDITOR'
              }
            }
          }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      });

      eligibleAttendees = users;
    } else if (meetingType === 'MANAGEMENT_REVIEW') {
      // For management review, get users with management roles
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          userRoles: {
            some: {
              role: {
                name: {
                  in: ['MANAGEMENT_REPRESENTATIVE', 'TOP_MANAGEMENT', 'QUALITY_MANAGER']
                }
              }
            }
          }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      });

      eligibleAttendees = users;
    }

    res.json({
      message: 'Eligible attendees retrieved successfully',
      attendees: eligibleAttendees
    });

  } catch (error) {
    logger.error('Error fetching eligible attendees:', error);
    next(error);
  }
});

module.exports = router;