const notificationService = require('../services/notificationService');

const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const {
      isRead,
      type,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20
    } = req.query;

    // Build filters object
    const filters = {
      isRead: isRead !== undefined ? isRead === 'true' : undefined,
      type: type || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      search: search || undefined,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await notificationService.getNotificationsForUser(userId, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

const markNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { notificationIds } = req.body;
    
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ 
        message: 'notificationIds must be a non-empty array' 
      });
    }
    
    await notificationService.markNotificationsRead(userId, notificationIds);
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    await notificationService.markAllNotificationsRead(userId);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.params;
    
    await notificationService.deleteNotification(userId, notificationId);
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const deleteMultipleNotifications = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { notificationIds } = req.body;
    
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ 
        message: 'notificationIds must be a non-empty array' 
      });
    }
    
    await notificationService.deleteMultipleNotifications(userId, notificationIds);
    res.json({ message: 'Notifications deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getNotificationStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const stats = await notificationService.getNotificationStats(userId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
};

const broadcastNotification = async (req, res, next) => {
  try {
    const {
      title,
      message,
      type,
      priority,
      auditId,
      departmentId,
      actionUrl,
      actionText,
      metadata
    } = req.body;
    
    // Validate required fields
    if (!title || !message || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Title, message, and type are required' 
      });
    }
    
    const senderId = req.user.userId;
    const tenantId = req.user.tenantId;
    
    const result = await notificationService.broadcastNotification({
      title,
      message,
      type,
      priority: priority || 'MEDIUM',
      auditId,
      departmentId,
      actionUrl,
      actionText,
      metadata,
      senderId,
      tenantId
    });
    
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteMultipleNotifications,
  getNotificationStats,
  broadcastNotification,
}; 