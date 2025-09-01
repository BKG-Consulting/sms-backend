const { prisma } = require('../../prisma/client');
const { uploadToS3 } = require('../utils/s3Upload');

async function sendMessage({ senderId, recipientId, tenantId, subject, body, files }) {
  // 1. Upload files to S3 and create MessageAttachment records
  const attachments = [];
  for (const file of files || []) {
    const { fileUrl, s3Key } = await uploadToS3(file.buffer, file.originalname, file.mimetype);
    attachments.push({ fileName: file.originalname, fileUrl, s3Key });
  }

  // 2. Create the message
  const message = await prisma.message.create({
    data: {
      senderId,
      recipientId,
      tenantId,
      subject,
      body,
      attachments: { create: attachments },
    },
    include: { 
      attachments: true,
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      recipient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    },
  });

  // 3. Emit socket event
  try {
    const io = require('./socketService').getIO();
    if (recipientId) {
      io.to(`user:${recipientId}`).emit('messageCreated', {
        ...message,
        senderName: `${message.sender.firstName} ${message.sender.lastName}`.trim() || message.sender.email
      });
    } else {
      io.to(`tenant:${tenantId}`).emit('messageCreated', {
        ...message,
        senderName: `${message.sender.firstName} ${message.sender.lastName}`.trim() || message.sender.email
      });
    }
  } catch (error) {
    console.error('Socket emit error:', error);
  }

  return message;
}

async function listMessages({ userId, tenantId, folder = 'inbox', limit = 20 }) {
  // folder: 'inbox' (received), 'sent', 'unread', 'starred', 'archive', 'trash'
  let where = { tenantId };
  
  if (folder === 'inbox') {
    where.recipientId = userId;
  } else if (folder === 'sent') {
    where.senderId = userId;
  } else if (folder === 'unread') {
    where.recipientId = userId;
    where.isRead = false;
  } else if (folder === 'starred') {
    where.recipientId = userId;
    where.metadata = { path: ['starred'], equals: true };
  } else if (folder === 'archive') {
    where.recipientId = userId;
    where.metadata = { path: ['archived'], equals: true };
  } else if (folder === 'trash') {
    where.recipientId = userId;
    where.metadata = { path: ['deleted'], equals: true };
  }

  const messages = await prisma.message.findMany({
    where,
    include: { 
      attachments: true, 
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }, 
      recipient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Transform messages to include sender/recipient names
  return messages.map(message => ({
    ...message,
    senderName: message.sender ? `${message.sender.firstName} ${message.sender.lastName}`.trim() || message.sender.email : 'System',
    recipientName: message.recipient ? `${message.recipient.firstName} ${message.recipient.lastName}`.trim() || message.recipient.email : 'Unknown',
    starred: message.metadata?.starred || false,
    archived: message.metadata?.archived || false,
    deleted: message.metadata?.deleted || false,
  }));
}

async function markAsRead({ messageId, userId }) {
  // Only allow recipient to mark as read
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.recipientId !== userId) throw new Error('Not authorized');
  
  const updatedMessage = await prisma.message.update({ 
    where: { id: messageId }, 
    data: { isRead: true },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  // Emit socket event for real-time update
  try {
    const io = require('./socketService').getIO();
    io.to(`user:${userId}`).emit('messageUpdated', {
      id: messageId,
      isRead: true,
      unread: false,
      senderName: `${updatedMessage.sender.firstName} ${updatedMessage.sender.lastName}`.trim() || updatedMessage.sender.email
    });
  } catch (error) {
    console.error('Socket emit error (markAsRead):', error);
  }

  return updatedMessage;
}

async function markAsUnread({ messageId, userId }) {
  // Only allow recipient to mark as unread
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.recipientId !== userId) throw new Error('Not authorized');
  
  const updatedMessage = await prisma.message.update({ 
    where: { id: messageId }, 
    data: { isRead: false },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      }
    }
  });

  // Emit socket event for real-time update
  try {
    const io = require('./socketService').getIO();
    io.to(`user:${userId}`).emit('messageUpdated', {
      id: messageId,
      isRead: false,
      unread: true,
      senderName: `${updatedMessage.sender.firstName} ${updatedMessage.sender.lastName}`.trim() || updatedMessage.sender.email
    });
  } catch (error) {
    console.error('Socket emit error (markAsUnread):', error);
  }

  return updatedMessage;
}

async function starMessage({ messageId, userId }) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.recipientId !== userId) throw new Error('Not authorized');
  
  const currentMetadata = message.metadata || {};
  const newStarred = !currentMetadata.starred;
  
  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: { 
      metadata: { 
        ...currentMetadata, 
        starred: newStarred 
      } 
    }
  });

  // Emit socket event for real-time update
  try {
    const io = require('./socketService').getIO();
    io.to(`user:${userId}`).emit('messageUpdated', {
      id: messageId,
      starred: newStarred
    });
  } catch (error) {
    console.error('Socket emit error (starMessage):', error);
  }

  return updatedMessage;
}

async function archiveMessage({ messageId, userId }) {
  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || message.recipientId !== userId) throw new Error('Not authorized');
  
  const currentMetadata = message.metadata || {};
  
  const updatedMessage = await prisma.message.update({
    where: { id: messageId },
    data: { 
      metadata: { 
        ...currentMetadata, 
        archived: true 
      } 
    }
  });

  // Emit socket event for real-time update
  try {
    const io = require('./socketService').getIO();
    io.to(`user:${userId}`).emit('messageUpdated', {
      id: messageId,
      archived: true
    });
  } catch (error) {
    console.error('Socket emit error (archiveMessage):', error);
  }

  return updatedMessage;
}

async function deleteMessage({ messageId, userId }) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { recipient: true }
  });

  if (!message) {
    throw new Error('Message not found');
  }

  if (message.recipientId !== userId) {
    throw new Error('Unauthorized to delete this message');
  }

  // Soft delete by updating metadata
  return prisma.message.update({
    where: { id: messageId },
    data: {
      metadata: {
        ...message.metadata,
        deleted: true,
        deletedAt: new Date().toISOString()
      }
    }
  });
}

async function sendManagementReviewInvitation({ 
  auditId, 
  meetingId, 
  senderId, 
  tenantId, 
  programTitle, 
  auditType, 
  meetingDate, 
  startTime, 
  endTime, 
  venue, 
  attendeeIds 
}) {
  console.log('📧 [MESSAGE_SERVICE] Sending Management Review invitations:', {
    auditId,
    meetingId,
    senderId,
    tenantId,
    programTitle,
    auditType,
    meetingDate,
    startTime,
    endTime,
    venue,
    attendeeCount: attendeeIds.length
  });

  const subject = `Management Review Meeting Invitation - ${programTitle}`;
  
  // Generate invitation message with exact format
  const body = `List
Management Review Invitation

Programme
${programTitle}

Audit Number
${auditType}

Management Review Meeting Date (S)
${new Date(meetingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

You are hereby notified and invited to the above mentioned forum to be held on the above mentioned date(S) from 
${startTime}
 to 
${endTime}
 at 
${venue}
.

The agenda of the meeting shall be
Results of audit
Customer feedback
Process performance and product conformity
Status of preventive and corrective action
Follow up actions from previous management review meetings
Changes that could affect the quality management system
Recommendations for improvement
Any other business

Kindly prepare accordingly
Yours Faithfully
Management Rep (Secretary to Management review meeting)`.trim();

  const messages = [];
  const errors = [];

  // Send invitation to each attendee
  for (const recipientId of attendeeIds) {
    try {
      console.log(`📧 [MESSAGE_SERVICE] Sending invitation to user: ${recipientId}`);
      
      const message = await prisma.message.create({
        data: {
          senderId,
          recipientId,
          tenantId,
          subject,
          body,
          metadata: {
            type: 'MANAGEMENT_REVIEW_INVITATION',
            auditId,
            meetingId,
            meetingDate,
            startTime,
            endTime,
            venue
          }
        },
        include: { 
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          recipient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // Emit socket event for real-time notification
      try {
        const io = require('./socketService').getIO();
        if (io) {
          io.to(`user:${recipientId}`).emit('messageCreated', {
            ...message,
            senderName: `${message.sender.firstName} ${message.sender.lastName}`.trim() || message.sender.email
          });
        }
      } catch (socketError) {
        console.error('Socket emit error:', socketError);
      }

      messages.push(message);
      console.log(`✅ [MESSAGE_SERVICE] Invitation sent successfully to: ${message.recipient.email}`);
      
    } catch (error) {
      console.error(`❌ [MESSAGE_SERVICE] Failed to send invitation to user ${recipientId}:`, error);
      errors.push({ recipientId, error: error.message });
    }
  }

  console.log(`📊 [MESSAGE_SERVICE] Invitation summary:`, {
    totalSent: messages.length,
    totalErrors: errors.length,
    errors
  });

  return {
    success: true,
    messages,
    errors,
    summary: {
      totalSent: messages.length,
      totalErrors: errors.length
    }
  };
}

module.exports = {
  sendMessage,
  listMessages,
  markAsRead,
  markAsUnread,
  starMessage,
  archiveMessage,
  deleteMessage,
  sendManagementReviewInvitation
}; 