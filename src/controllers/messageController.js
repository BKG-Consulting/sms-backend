const messageService = require('../services/messageService');
const notificationService = require('../services/notificationService');
const { prisma } = require('../../prisma/client');

const sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user.userId;
    const tenantId = req.user.tenantId;
    const { recipientId, subject, body } = req.body;
    const files = req.files || [];
    const message = await messageService.sendMessage({ senderId, recipientId, tenantId, subject, body, files });
    res.status(201).json({ message: 'Message sent successfully', data: message });
  } catch (error) {
    next(error);
  }
};

const listMessages = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    const { folder, limit } = req.query;
    const parsedLimit = limit ? parseInt(limit, 10) : undefined;
    const messages = await messageService.listMessages({ userId, tenantId, folder, limit: parsedLimit });
    res.json({ messages });
  } catch (error) {
    next(error);
  }
};

const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    await messageService.markAsRead({ messageId: id, userId });
    res.json({ message: 'Message marked as read' });
  } catch (error) {
    next(error);
  }
};

const markAsUnread = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    await messageService.markAsUnread({ messageId: id, userId });
    res.json({ message: 'Message marked as unread' });
  } catch (error) {
    next(error);
  }
};

const starMessage = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    await messageService.starMessage({ messageId: id, userId });
    res.json({ message: 'Message starred/unstarred' });
  } catch (error) {
    next(error);
  }
};

const archiveMessage = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    await messageService.archiveMessage({ messageId: id, userId });
    res.json({ message: 'Message archived' });
  } catch (error) {
    next(error);
  }
};

const deleteMessage = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    await messageService.deleteMessage({ messageId: id, userId });
    res.json({ message: 'Message deleted' });
  } catch (error) {
    next(error);
  }
};

const getGeneralAuditNotificationDate = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const tenantId = req.user.tenantId;
    
    console.log('🔍 [MESSAGE_CONTROLLER] Looking for general audit notification:', { auditId, tenantId });
    
    const message = await prisma.message.findFirst({
      where: {
        subject: 'General Audit Notification',
        tenantId,
        metadata: { path: ['auditId'], equals: auditId }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('🔍 [MESSAGE_CONTROLLER] Found message:', message ? 'Yes' : 'No');
    
    if (!message) {
      console.log('🔍 [MESSAGE_CONTROLLER] No notification found, returning 404');
      return res.status(404).json({ message: 'No notification found' });
    }
    
    console.log('🔍 [MESSAGE_CONTROLLER] Returning notification date:', message.createdAt);
    res.json({ date: message.createdAt, message });
  } catch (error) {
    console.error('❌ [MESSAGE_CONTROLLER] Error in getGeneralAuditNotificationDate:', error);
    next(error);
  }
};

const sendManagementReviewInvitation = async (req, res, next) => {
  try {
    const senderId = req.user.userId;
    const tenantId = req.user.tenantId;
    
    // Check if the sender has permission to create management review meetings
    const hasPermission = require('../utils/permissionUtils').hasPermission;
    if (!hasPermission(req.user, 'managementReview:create')) {
      return res.status(403).json({
        success: false,
        message: 'You don\'t have permission to create management review invitations'
      });
    }
    const { 
      auditId, 
      meetingDate, 
      startTime, 
      endTime, 
      venue
    } = req.body;

    console.log('📧 [CONTROLLER] Management Review invitation request:', {
      senderId,
      tenantId,
      auditId,
      meetingDate,
      startTime,
      endTime,
      venue
    });

    if (!auditId || !meetingDate || !startTime || !endTime || !venue) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: auditId, meetingDate, startTime, endTime, venue' 
      });
    }

    // Get audit details to extract program title and audit type
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      include: {
        auditProgram: {
          select: { title: true }
        }
      }
    });

    if (!audit) {
      return res.status(404).json({
        success: false,
        message: 'Audit not found'
      });
    }

    // Get users with management review view permission
    const usersWithPermission = await notificationService.getUsersWithPermission(tenantId, 'managementReview', 'view');

    if (usersWithPermission.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No users found with management review permission',
        data: { notifiedUsers: 0 }
      });
    }

    const attendeeIds = usersWithPermission.map(user => user.id);

    const result = await messageService.sendManagementReviewInvitation({
      auditId,
      meetingId: null, // Will be created after invitation
      senderId,
      tenantId,
      programTitle: audit.auditProgram.title,
      auditType: audit.type,
      meetingDate,
      startTime,
      endTime,
      venue,
      attendeeIds
    });

    console.log('✅ [CONTROLLER] Management Review invitations sent successfully:', {
      totalSent: result.summary.totalSent,
      totalErrors: result.summary.totalErrors
    });

    res.status(200).json({
      success: true,
      message: `Management Review invitations sent successfully. ${result.summary.totalSent} sent, ${result.summary.totalErrors} failed.`,
      data: result
    });

  } catch (error) {
    console.error('❌ [CONTROLLER] Failed to send Management Review invitations:', error);
    next(error);
  }
};

module.exports = { 
  sendMessage, 
  listMessages, 
  markAsRead, 
  markAsUnread,
  starMessage, 
  archiveMessage, 
  deleteMessage,
  getGeneralAuditNotificationDate,
  sendManagementReviewInvitation
}; 