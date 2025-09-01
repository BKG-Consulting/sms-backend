const { prisma } = require('../../prisma/client');
const { hasPermission } = require('../utils/permissionUtils');

const notificationService = {
  /**
   * Get users who have a specific permission in a tenant
   * @param {string} tenantId - The tenant ID
   * @param {string} module - The permission module (e.g., 'document')
   * @param {string} action - The permission action (e.g., 'read')
   * @returns {Array} Array of users with the specified permission
   */
  getUsersWithPermission: async (tenantId, module, action) => {
    try {
      // First, find the permission we're looking for
      const permission = await prisma.permission.findFirst({
        where: { module, action }
      });

      if (!permission) {
        console.log(`[NOTIFICATION] Permission ${module}:${action} not found in database`);
        return [];
      }

      // Find all roles that have this permission
      const rolePermissions = await prisma.rolePermission.findMany({
        where: {
          permissionId: permission.id,
          allowed: true
        },
        include: {
          role: true
        }
      });

      const roleIds = rolePermissions.map(rp => rp.roleId);

      if (roleIds.length === 0) {
        console.log(`[NOTIFICATION] No roles found with permission ${module}:${action}`);
        return [];
      }

      // Find all users in the tenant who have any of these roles
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          OR: [
            // Users with the role as a tenant-wide role
            {
              userRoles: {
                some: {
                  roleId: { in: roleIds }
                }
              }
            },
            // Users with the role as a department-specific role
            {
              userDepartmentRoles: {
                some: {
                  roleId: { in: roleIds }
                }
              }
            }
          ]
        },
        include: {
          userRoles: { 
            include: { 
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true
                    }
                  }
                }
              } 
            } 
          },
          userDepartmentRoles: { 
            include: { 
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true
                    }
                  }
                }
              },
              department: true
            } 
          }
        }
      });

      console.log(`[NOTIFICATION] Found ${users.length} users with permission ${module}:${action} through roles: ${rolePermissions.map(rp => rp.role.name).join(', ')}`);
      
      return users;
    } catch (error) {
      console.error('[NOTIFICATION] Error getting users with permission:', error);
      throw error;
    }
  },

  /**
   * Send notification to users with specific permission
   * @param {Object} notificationData - Notification data
   * @param {string} requiredPermission - Required permission (e.g., 'document:read')
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Notification result
   */
  sendNotificationToUsersWithPermission: async (notificationData, requiredPermission, tenantId) => {
    try {
      const [module, action] = requiredPermission.split(':');
      
      // Get users with the required permission
      const usersWithPermission = await notificationService.getUsersWithPermission(tenantId, module, action);
      
      if (usersWithPermission.length === 0) {
        console.log(`[NOTIFICATION] No users found with permission ${requiredPermission}`);
        return {
          success: true,
          notifiedUsers: 0,
          message: `No users with permission ${requiredPermission} found`
        };
      }

      // Get socket.io instance for real-time notifications
      let io;
      try {
        const socketService = require('./socketService');
        io = socketService.getIO();
      } catch (error) {
        console.error('Socket service not available:', error);
        io = null;
      }

      // Create notifications for users with permission
      const notifications = [];
      
      for (const user of usersWithPermission) {
        const notification = await prisma.notification.create({
          data: {
            ...notificationData,
            tenantId,
            targetUserId: user.id
          }
        });
        
        notifications.push(notification);
        
        // Emit real-time notification if socket is available
        if (io) {
          try {
            io.to(`user:${user.id}`).emit('notificationCreated', { 
              ...notification, 
              userId: user.id 
            });
          } catch (socketError) {
            console.error('Failed to emit socket notification:', socketError);
          }
        }
      }

      console.log(`[NOTIFICATION] Successfully notified ${notifications.length} users with permission ${requiredPermission}`);
      
      return {
        success: true,
        notifiedUsers: notifications.length,
        notifications,
        message: `Successfully notified ${notifications.length} users with permission ${requiredPermission}`
      };
    } catch (error) {
      console.error('[NOTIFICATION] Error sending permission-based notification:', error);
      throw error;
    }
  },

  /**
   * Send document published notification to users with document read permission
   * @param {Object} documentData - Document data
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Notification result
   */
  sendDocumentPublishedNotification: async (documentData, tenantId) => {
    const notificationData = {
      type: 'DOCUMENT_PUBLISHED',
      title: 'New Document Published',
      message: `The document "${documentData.title}" is now available.`,
      link: `/documents/${documentData.id}`
    };

    return await notificationService.sendNotificationToUsersWithPermission(
      notificationData,
      'document:read',
      tenantId
    );
  },

  /**
   * Send change request notification to users with change request approval permission
   * Targets users within the requester's department who can approve change requests
   * @param {Object} changeRequestData - Change request data
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Notification result
   */
  sendChangeRequestNotification: async (changeRequestData, tenantId) => {
    try {
      // Get users with documentChangeRequest:approve permission in the tenant
      const usersWithApprovalPermission = await notificationService.getUsersWithPermission(
        tenantId, 
        'documentChangeRequest', 
        'approve'
      );

      if (usersWithApprovalPermission.length === 0) {
        console.log('[NOTIFICATION] No users found with documentChangeRequest:approve permission');
        return {
          success: true,
          notifiedUsers: 0,
          message: 'No users with change request approval permission found'
        };
      }

      // Filter to users in the same department as the requester (if requester has departments)
      let targetUsers = usersWithApprovalPermission;
      
      if (changeRequestData.requestedBy?.userDepartmentRoles?.length > 0) {
        const requesterDepartmentIds = changeRequestData.requestedBy.userDepartmentRoles.map(
          udr => udr.departmentId
        );
        
        // Filter users who are in the same department(s) as the requester
        targetUsers = usersWithApprovalPermission.filter(user => {
          return user.userDepartmentRoles?.some(udr => 
            requesterDepartmentIds.includes(udr.departmentId)
          );
        });

        console.log(`[NOTIFICATION] Filtered to ${targetUsers.length} users in requester's departments (${requesterDepartmentIds.join(', ')})`);
      }

      // Don't notify the requester themselves
      targetUsers = targetUsers.filter(user => user.id !== changeRequestData.requestedById);

      if (targetUsers.length === 0) {
        console.log('[NOTIFICATION] No eligible users found after filtering');
        return {
          success: true,
          notifiedUsers: 0,
          message: 'No eligible users found for change request notification'
        };
      }

      // Get socket.io instance for real-time notifications
      let io;
      try {
        const socketService = require('./socketService');
        io = socketService.getIO();
      } catch (error) {
        console.error('Socket service not available:', error);
        io = null;
      }

      // Create notifications for eligible users
      const notifications = [];
      
      for (const user of targetUsers) {
        const notification = await prisma.notification.create({
          data: {
            type: 'CHANGE_REQUEST_CREATED',
            title: 'New Change Request for Approval',
            message: `${changeRequestData.requestedBy.firstName} ${changeRequestData.requestedBy.lastName} has submitted a change request for document "${changeRequestData.document.title}" (Clause ${changeRequestData.clauseNumber}).`,
            link: `/change-requests/${changeRequestData.id}`,
            tenantId,
            targetUserId: user.id,
            metadata: JSON.stringify({
              changeRequestId: changeRequestData.id,
              documentId: changeRequestData.document.id,
              clauseNumber: changeRequestData.clauseNumber,
              requestedById: changeRequestData.requestedById
            })
          }
        });
        
        notifications.push(notification);
        
        // Emit real-time notification if socket is available
        if (io) {
          try {
            io.to(`user:${user.id}`).emit('notificationCreated', { 
              ...notification, 
              userId: user.id 
            });
          } catch (socketError) {
            console.error('Failed to emit socket notification:', socketError);
          }
        }
      }

      console.log(`[NOTIFICATION] Successfully sent change request notifications to ${notifications.length} users with approval permission`);
      
      return {
        success: true,
        notifiedUsers: notifications.length,
        notifications,
        message: `Change request notification sent to ${notifications.length} users with approval permission`
      };
    } catch (error) {
      console.error('[NOTIFICATION] Error sending change request notification:', error);
      throw error;
    }
  },

  /**
   * Send change request approval notification to users with publish permission
   * @param {Object} changeRequestData - Change request data
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Notification result
   */
  sendChangeRequestApprovalNotification: async (changeRequestData, tenantId) => {
    const notificationData = {
      type: 'CHANGE_REQUEST_APPROVED',
      title: 'Change Request Approved',
      message: `Change request for document "${changeRequestData.document.title}" has been approved and is ready for implementation.`,
      link: `/change-requests/${changeRequestData.id}`
    };

    return await notificationService.sendNotificationToUsersWithPermission(
      notificationData,
      'document:publish',
      tenantId
    );
  },

  /**
   * Send change request rejection notification to the requester
   * @param {Object} changeRequestData - Change request data
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Notification result
   */
  sendChangeRequestRejectionNotification: async (changeRequestData, tenantId) => {
    try {
      // Create notification for the specific requester
      const notification = await prisma.notification.create({
        data: {
          type: 'CHANGE_REQUEST_REJECTED',
          title: 'Change Request Rejected',
          message: `Your change request for document "${changeRequestData.document.title}" has been rejected.`,
          link: `/change-requests/${changeRequestData.id}`,
          tenantId,
          targetUserId: changeRequestData.requestedById
        }
      });

      // Get socket.io instance for real-time notifications
      let io;
      try {
        const socketService = require('./socketService');
        io = socketService.getIO();
      } catch (error) {
        console.error('Socket service not available:', error);
        io = null;
      }

      // Emit real-time notification if socket is available
      if (io) {
        try {
          io.to(`user:${changeRequestData.requestedById}`).emit('notificationCreated', { 
            ...notification, 
            userId: changeRequestData.requestedById 
          });
        } catch (socketError) {
          console.error('Failed to emit socket notification:', socketError);
        }
      }

      console.log(`[NOTIFICATION] Sent rejection notification to user ${changeRequestData.requestedById}`);

      return {
        success: true,
        notifiedUsers: 1,
        notification,
        message: 'Change request rejection notification sent to requester'
      };
    } catch (error) {
      console.error('[NOTIFICATION] Error sending change request rejection notification:', error);
      throw error;
    }
  },

  /**
   * Get notifications for a specific user with filtering and pagination
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Paginated notifications result
   */
  getNotificationsForUser: async (userId, filters = {}) => {
    try {
      const {
        isRead,
        type,
        startDate,
        endDate,
        search,
        page = 1,
        limit = 20
      } = filters;

      // Build where clause
      const where = {
        targetUserId: userId
      };

      if (isRead !== undefined) {
        where.isRead = isRead;
      }

      if (type) {
        where.type = type;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { message: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Get total count
      const total = await prisma.notification.count({ where });

      // Get paginated notifications
      const notifications = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      });

      return {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('[NOTIFICATION] Error getting notifications for user:', error);
      throw error;
    }
  },

  /**
   * Mark specific notifications as read
   * @param {string} userId - User ID
   * @param {Array} notificationIds - Array of notification IDs
   */
  markNotificationsRead: async (userId, notificationIds) => {
    try {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          targetUserId: userId
        },
        data: {
          isRead: true
        }
      });

      console.log(`[NOTIFICATION] Marked ${notificationIds.length} notifications as read for user ${userId}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error marking notifications as read:', error);
      throw error;
    }
  },

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   */
  markAllNotificationsRead: async (userId) => {
    try {
      await prisma.notification.updateMany({
        where: {
          targetUserId: userId,
          isRead: false
        },
        data: {
          isRead: true
        }
      });

      console.log(`[NOTIFICATION] Marked all notifications as read for user ${userId}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error marking all notifications as read:', error);
      throw error;
    }
  },

  /**
   * Delete a specific notification
   * @param {string} userId - User ID
   * @param {string} notificationId - Notification ID
   */
  deleteNotification: async (userId, notificationId) => {
    try {
      await prisma.notification.deleteMany({
        where: {
          id: notificationId,
          targetUserId: userId
        }
      });

      console.log(`[NOTIFICATION] Deleted notification ${notificationId} for user ${userId}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error deleting notification:', error);
      throw error;
    }
  },

  /**
   * Delete multiple notifications
   * @param {string} userId - User ID
   * @param {Array} notificationIds - Array of notification IDs
   */
  deleteMultipleNotifications: async (userId, notificationIds) => {
    try {
      await prisma.notification.deleteMany({
        where: {
          id: { in: notificationIds },
          targetUserId: userId
        }
      });

      console.log(`[NOTIFICATION] Deleted ${notificationIds.length} notifications for user ${userId}`);
    } catch (error) {
      console.error('[NOTIFICATION] Error deleting multiple notifications:', error);
      throw error;
    }
  },

  /**
   * Get notification statistics for a user
   * @param {string} userId - User ID
   * @returns {Object} Notification statistics
   */
  getNotificationStats: async (userId) => {
    try {
      const [total, unread, byType] = await Promise.all([
        // Total notifications
        prisma.notification.count({
          where: { targetUserId: userId }
        }),
        
        // Unread notifications
        prisma.notification.count({
          where: { 
            targetUserId: userId,
            isRead: false
          }
        }),
        
        // Notifications by type
        prisma.notification.groupBy({
          by: ['type'],
          where: { targetUserId: userId },
          _count: {
            id: true
          }
        })
      ]);

      return {
        total,
        unread,
        read: total - unread,
        byType: byType.reduce((acc, item) => {
          acc[item.type] = item._count.id;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('[NOTIFICATION] Error getting notification stats:', error);
      throw error;
    }
  },

  /**
   * Broadcast notification to multiple users
   * @param {Object} notificationData - Notification data
   * @returns {Object} Broadcast result
   */
  broadcastNotification: async (notificationData) => {
    try {
      const {
        title,
        message,
        type,
        auditId,
        departmentId,
        actionUrl,
        actionText,
        metadata,
        senderId,
        tenantId
      } = notificationData;

      // Determine target users based on filters
      let targetUsers = [];
      
      if (departmentId) {
        // Send to users in specific department
        targetUsers = await prisma.user.findMany({
          where: {
            tenantId,
            userDepartmentRoles: {
              some: {
                departmentId
              }
            }
          }
        });
      } else {
        // Send to all users in tenant
        targetUsers = await prisma.user.findMany({
          where: { tenantId }
        });
      }

      // Create notifications for all target users
      const notifications = [];
      for (const user of targetUsers) {
        if (user.id !== senderId) { // Don't send to sender
          const notification = await prisma.notification.create({
            data: {
              type,
              title,
              message,
              tenantId,
              targetUserId: user.id,
              link: actionUrl,
              metadata: metadata ? JSON.stringify(metadata) : null
            }
          });
          notifications.push(notification);
        }
      }

      // Get socket.io instance for real-time notifications
      let io;
      try {
        const socketService = require('./socketService');
        io = socketService.getIO();
      } catch (error) {
        console.error('Socket service not available:', error);
        io = null;
      }

      // Emit real-time notifications
      if (io) {
        for (const notification of notifications) {
          try {
            io.to(`user:${notification.targetUserId}`).emit('notificationCreated', {
              ...notification,
              userId: notification.targetUserId
            });
          } catch (socketError) {
            console.error('Failed to emit socket notification:', socketError);
          }
        }
      }

      console.log(`[NOTIFICATION] Broadcast notification sent to ${notifications.length} users`);

      return {
        success: true,
        notifiedUsers: notifications.length,
        notifications,
        message: `Broadcast notification sent to ${notifications.length} users`
      };
    } catch (error) {
      console.error('[NOTIFICATION] Error broadcasting notification:', error);
      throw error;
    }
  }
};

module.exports = notificationService; 