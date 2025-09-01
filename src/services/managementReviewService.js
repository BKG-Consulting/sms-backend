const { prisma } = require('../../prisma/client');
const { AppError } = require('../../errors/app.error');

// Predefined Management Review Minutes
const MANAGEMENT_REVIEW_MINUTES = [
  { title: 'MIN 1: PRELIMINARIES', order: 1 },
  { title: 'MIN 2: READING AND CONFIRMATION OF PREVIOUS MINUTES', order: 2 },
  { title: 'MIN 3: MATTERS ARISING - FOLLOWUP ACTIONS FROM PREVIOUS MANAGEMENT REVIEW MEETING', order: 3 },
  { title: 'MIN 4: RESULTS OF AUDIT', order: 4 },
  { title: 'MIN 5: CUSTOMER FEEDBACK', order: 5 },
  { title: 'MIN 6: PROCESS PERFORMANCE AND PRODUCT CONFORMITY', order: 6 },
  { title: 'MIN 7: STATUS OF PREVENTIVE AND CORRECTIVE ACTION', order: 7 },
  { title: 'MIN 8: CHANGES THAT COULD AFFECT THE QUALITY MANAGEMENT SYSTEM', order: 8 },
  { title: 'MIN 9: RECOMMENDATIONS FOR IMPROVEMENT', order: 9 },
  { title: 'MIN 10: ANY OTHER BUSINESS (AOB)', order: 10 }
];

/**
 * Send Management Review Invitation
 */
const sendManagementReviewInvitation = async (auditId, data, tenantId) => {
  try {
    const { 
      senderId, 
      meetingDate, 
      startTime, 
      endTime, 
      venue 
    } = data;

    // Verify audit exists and belongs to tenant
    const audit = await prisma.audit.findFirst({
      where: {
        id: auditId,
        auditProgram: {
          tenantId: tenantId
        }
      },
      include: {
        auditProgram: {
          select: { title: true }
        }
      }
    });

    if (!audit) {
      throw new AppError('Audit not found', 404);
    }

    // Check if invitation has already been sent
    if (audit.managementReviewInvitationSentAt) {
      throw new AppError('Management review invitation has already been sent for this audit', 400);
    }

    // Get users with management review read permission (using the same approach as the original message service)
    const notificationService = require('./notificationService');
    console.log(`[MANAGEMENT_REVIEW] Looking for users with permission: managementReview:read in tenant: ${tenantId}`);
    const usersWithPermission = await notificationService.getUsersWithPermission(tenantId, 'managementReview', 'read');
    console.log(`[MANAGEMENT_REVIEW] Found ${usersWithPermission.length} users with permission:`, usersWithPermission.map(u => `${u.firstName} ${u.lastName} (${u.email})`));

    if (usersWithPermission.length === 0) {
      throw new AppError('No users found with management review permission', 400);
    }

    // Update audit to track invitation sent
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        managementReviewInvitationSentAt: new Date(),
        managementReviewInvitationSentBy: senderId
      }
    });

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'SEND_MANAGEMENT_REVIEW_INVITATION',
        entityType: 'AUDIT',
        entityId: auditId,
        user: {
          connect: { id: senderId }
        },
        tenant: {
          connect: { id: tenantId }
        },
        details: `Management Review invitation sent for audit ${audit.auditNo} (${audit.auditProgram.title})`,
        metadata: { 
          auditId, 
          programId: audit.auditProgram.id,
          invitedUsers: usersWithPermission.length,
          meetingDate,
          startTime,
          endTime,
          venue
        },
      },
    });

    // Send invitation messages
    const messages = [];
    const errors = [];

    const subject = `Management Review Meeting Invitation - ${audit.auditProgram.title}`;
    
    // Generate invitation message with exact format from original message service
    const body = `List
Management Review Invitation

Programme
${audit.auditProgram.title}

Audit Number
${audit.type}

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

    console.log(`[MANAGEMENT_REVIEW] Sending invitations to ${usersWithPermission.length} users:`, usersWithPermission.map(u => `${u.firstName} ${u.lastName} (${u.email})`));

    for (const user of usersWithPermission) {
      try {
        console.log(`[MANAGEMENT_REVIEW] Creating message for user: ${user.firstName} ${user.lastName} (${user.id})`);
        
        const message = await prisma.message.create({
          data: {
            senderId,
            recipientId: user.id,
            tenantId,
            subject,
            body,
            metadata: {
              type: 'MANAGEMENT_REVIEW_INVITATION',
              auditId,
              meetingDate,
              startTime,
              endTime,
              venue
            }
          },
          include: {
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
        
        console.log(`[MANAGEMENT_REVIEW] Message created successfully for user ${user.id}:`, message.id);
        messages.push(message);
      } catch (error) {
        console.error(`[MANAGEMENT_REVIEW] Error creating message for user ${user.id}:`, error);
        errors.push({ userId: user.id, error: error.message });
      }
    }

    // Emit socket events for real-time notifications
    try {
      const socketService = require('./socketService');
      const io = socketService.getIO();
      
      for (const user of usersWithPermission) {
        io.to(`user:${user.id}`).emit('messageCreated', {
          subject,
          body,
          recipientId: user.id,
          senderName: `${audit.auditProgram.title} Management Review`,
          metadata: {
            type: 'MANAGEMENT_REVIEW_INVITATION',
            auditId,
            meetingDate,
            startTime,
            endTime,
            venue
          }
        });
      }
      
      console.log(`[MANAGEMENT_REVIEW] Socket events emitted for ${usersWithPermission.length} users`);
    } catch (socketError) {
      console.error('[MANAGEMENT_REVIEW] Socket emit error:', socketError);
    }

    return {
      success: true,
      message: `Management Review invitations sent successfully. ${messages.length} sent, ${errors.length} failed.`,
      data: {
        messages,
        errors,
        summary: {
          totalSent: messages.length,
          totalErrors: errors.length,
          totalInvited: usersWithPermission.length
        }
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Check if Management Review invitation has been sent
 */
const checkManagementReviewInvitationStatus = async (auditId, tenantId) => {
  try {
    const audit = await prisma.audit.findFirst({
      where: {
        id: auditId,
        auditProgram: {
          tenantId: tenantId
        }
      },
      select: {
        id: true,
        managementReviewInvitationSentAt: true,
        managementReviewInvitationSentBy: true,
        managementReviewInvitationSender: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (!audit) {
      throw new AppError('Audit not found', 404);
    }

    return {
      invitationSent: !!audit.managementReviewInvitationSentAt,
      invitationSentAt: audit.managementReviewInvitationSentAt,
      invitationSentBy: audit.managementReviewInvitationSender
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Create a new Management Review Meeting
 */
const createManagementReviewMeeting = async (auditId, data, tenantId) => {
  try {
    const { notes, createdBy, venue, scheduledAt, attendances, minutes } = data;

    console.log('🔍 Creating management review meeting with data:', {
      auditId,
      createdBy,
      attendancesCount: attendances ? Object.keys(attendances).length : 0,
      minutesCount: minutes ? minutes.length : 0,
      fullData: data
    });

    // Verify audit exists and belongs to tenant
    const audit = await prisma.audit.findFirst({
      where: {
        id: auditId,
        auditProgram: {
          tenantId: tenantId
        }
      }
    });

    if (!audit) {
      throw new AppError('Audit not found', 404);
    }

    if (!createdBy) {
      throw new AppError('CreatedBy user ID is required', 400);
    }

    console.log('🔍 About to create meeting with createdBy:', createdBy);

    // Create management review meeting
    const meeting = await prisma.managementReviewMeeting.create({
      data: {
        audit: {
          connect: { id: auditId }
        },
        notes: notes || '',
        createdBy: {
          connect: { id: createdBy }
        },
        venue: venue || null,
        scheduledAt: scheduledAt || new Date(),
        status: 'UPCOMING'
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    console.log('✅ Created meeting:', meeting.id);

    // Create attendance records if provided
    const attendanceRecords = [];
    if (attendances && typeof attendances === 'object') {
      for (const [userId, present] of Object.entries(attendances)) {
        const attendance = await prisma.managementReviewAttendance.create({
          data: {
            meetingId: meeting.id,
            userId,
            present: !!present,
            remarks: present ? 'Marked as present' : 'Marked as absent'
          }
        });
        attendanceRecords.push(attendance);
        console.log('✅ Created attendance for user:', userId, 'present:', present);
      }
    }

    // Create minutes (use provided minutes or predefined ones)
    const minuteRecords = [];
    const minutesToCreate = minutes && minutes.length > 0 ? minutes : MANAGEMENT_REVIEW_MINUTES;
    
    for (const minute of minutesToCreate) {
      const minuteData = {
        meetingId: meeting.id,
        title: minute.title,
        order: minute.order,
        notes: minute.notes || ''
      };
      
      const createdMinute = await prisma.managementReviewMinute.create({
        data: minuteData
      });
      minuteRecords.push(createdMinute);
      console.log('✅ Created minute:', createdMinute.title);
    }

    return { 
      meeting: {
        ...meeting,
        minutes: minuteRecords,
        attendances: attendanceRecords
      }
    };
  } catch (error) {
    console.error('❌ Error creating management review meeting:', error);
    throw error;
  }
};

/**
 * Get Management Review Meeting for an audit
 */
const getManagementReviewMeetingForAudit = async (auditId, tenantId) => {
  try {
    // Verify audit exists and belongs to tenant
    const audit = await prisma.audit.findFirst({
      where: {
        id: auditId,
        auditProgram: {
          tenantId: tenantId
        }
      }
    });

    if (!audit) {
      throw new AppError('Audit not found', 404);
    }

    // Get management review meeting
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        auditId,
        audit: {
          auditProgram: {
            tenantId: tenantId
          }
        }
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        minutes: {
          orderBy: {
            order: 'asc'
          }
        },
        attendances: {
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

    console.log('🔍 Backend: Meeting data returned:', {
      meetingId: meeting?.id,
      minutesCount: meeting?.minutes?.length || 0,
      attendanceCount: meeting?.attendances?.length || 0,
      attendanceData: meeting?.attendances?.map(att => ({
        id: att.id,
        userId: att.userId,
        present: att.present,
        user: att.user ? {
          id: att.user.id,
          firstName: att.user.firstName,
          lastName: att.user.lastName,
          email: att.user.email
        } : null
      }))
    });
    
    return { meeting };
  } catch (error) {
    throw error;
  }
};

/**
 * Update Management Review Meeting
 */
const updateManagementReviewMeeting = async (meetingId, data, tenantId) => {
  try {
    const { notes, venue, scheduledAt, status, attendances, minutes } = data;

    console.log('🔍 Backend service updating meeting:', {
      meetingId,
      notes,
      attendancesCount: attendances ? Object.keys(attendances).length : 0,
      minutesCount: minutes ? minutes.length : 0
    });

    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        audit: {
          auditProgram: {
            tenantId: tenantId
          }
        }
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    // Update meeting
    const updatedMeeting = await prisma.managementReviewMeeting.update({
      where: { id: meetingId },
      data: {
        notes: notes !== undefined ? notes : meeting.notes,
        venue: venue !== undefined ? venue : meeting.venue,
        scheduledAt: scheduledAt !== undefined ? scheduledAt : meeting.scheduledAt,
        status: status !== undefined ? status : meeting.status
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    // Update attendance records if provided
    if (attendances && typeof attendances === 'object') {
      console.log('🔍 Updating attendance records for meeting:', meetingId);
      
      // Delete existing attendance records
      await prisma.managementReviewAttendance.deleteMany({
        where: { meetingId }
      });

      // Create new attendance records
      for (const [userId, present] of Object.entries(attendances)) {
        await prisma.managementReviewAttendance.create({
          data: {
            meetingId,
            userId,
            present: !!present,
            remarks: present ? 'Marked as present' : 'Marked as absent'
          }
        });
        console.log('✅ Updated attendance for user:', userId, 'present:', present);
      }
    }

    // Update minutes if provided
    if (minutes && Array.isArray(minutes)) {
      console.log('🔍 Updating minutes for meeting:', meetingId);
      
      // Delete existing minutes
      await prisma.managementReviewMinute.deleteMany({
        where: { meetingId }
      });

      // Create new minutes
      for (const minute of minutes) {
        await prisma.managementReviewMinute.create({
          data: {
            meetingId,
            title: minute.title,
            order: minute.order,
            notes: minute.notes || '',
            discussed: minute.discussed || false
          }
        });
        console.log('✅ Updated minute:', minute.title);
      }
    }

    // Get updated meeting with all relations
    const finalMeeting = await prisma.managementReviewMeeting.findFirst({
      where: { id: meetingId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        minutes: {
          orderBy: {
            order: 'asc'
          }
        },
        attendances: {
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

    return { meeting: finalMeeting };
  } catch (error) {
    console.error('❌ Error updating management review meeting:', error);
    throw error;
  }
};

/**
 * Delete Management Review Meeting
 */
const deleteManagementReviewMeeting = async (meetingId, tenantId) => {
  try {
    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        audit: {
          auditProgram: {
            tenantId: tenantId
          }
        }
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    // Delete meeting (cascade will handle minutes and attendance)
    await prisma.managementReviewMeeting.delete({
      where: { id: meetingId }
    });

    return { success: true };
  } catch (error) {
    throw error;
  }
};

/**
 * Create or Update Minute Item
 */
const createOrUpdateMinuteItem = async (meetingId, data, tenantId) => {
  try {
    const { title, order, notes } = data;

    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        audit: {
          auditProgram: {
            tenantId: tenantId
          }
        }
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    // Check if minute already exists
    const existingMinute = await prisma.managementReviewMinute.findFirst({
      where: {
        meetingId,
        order
      }
    });

    let minute;
    if (existingMinute) {
      // Update existing minute
      minute = await prisma.managementReviewMinute.update({
        where: { id: existingMinute.id },
        data: {
          notes: notes || ''
        }
      });
    } else {
      // Create new minute
      minute = await prisma.managementReviewMinute.create({
        data: {
          meetingId,
          title: title || `MIN ${order}`,
          order,
          notes: notes || ''
        }
      });
    }

    return { minute };
  } catch (error) {
    throw error;
  }
};

/**
 * Update Minute Item
 */
const updateMinuteItem = async (minuteId, data, tenantId) => {
  try {
    const { notes } = data;

    // Verify minute exists and belongs to tenant
    const minute = await prisma.managementReviewMinute.findFirst({
      where: {
        id: minuteId,
        meeting: {
          audit: {
            auditProgram: {
              tenantId: tenantId
            }
          }
        }
      }
    });

    if (!minute) {
      throw new AppError('Minute item not found', 404);
    }

    // Update minute item
    const updatedMinute = await prisma.managementReviewMinute.update({
      where: { id: minuteId },
      data: {
        notes: notes || ''
      }
    });

    return { minute: updatedMinute };
  } catch (error) {
    throw error;
  }
};

/**
 * Delete Minute Item
 */
const deleteMinuteItem = async (minuteId, tenantId) => {
  try {
    // Verify minute exists and belongs to tenant
    const minute = await prisma.managementReviewMinute.findFirst({
      where: {
        id: minuteId,
        meeting: {
          audit: {
            auditProgram: {
              tenantId: tenantId
            }
          }
        }
      }
    });

    if (!minute) {
      throw new AppError('Minute item not found', 404);
    }

    // Delete minute item
    await prisma.managementReviewMinute.delete({
      where: { id: minuteId }
    });

    return { success: true };
  } catch (error) {
    throw error;
  }
};

/**
 * Create or Update Attendance
 */
const createOrUpdateAttendance = async (meetingId, userId, data, tenantId) => {
  try {
    const { present, remarks } = data;

    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        audit: {
          auditProgram: {
            tenantId: tenantId
          }
        }
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    // Check if attendance already exists
    const existingAttendance = await prisma.managementReviewAttendance.findFirst({
      where: {
        meetingId,
        userId
      }
    });

    let attendance;
    if (existingAttendance) {
      // Update existing attendance
      attendance = await prisma.managementReviewAttendance.update({
        where: { id: existingAttendance.id },
        data: {
          present: present !== undefined ? present : existingAttendance.present,
          remarks: remarks !== undefined ? remarks : existingAttendance.remarks
        },
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
      });
    } else {
      // Create new attendance
      attendance = await prisma.managementReviewAttendance.create({
        data: {
          meetingId,
          userId,
          present: present || false,
          remarks: remarks || null
        },
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
      });
    }

    return { attendance };
  } catch (error) {
    throw error;
  }
};

/**
 * Get Attendances for a meeting
 */
const getAttendancesByMeeting = async (meetingId, tenantId) => {
  try {
    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        audit: {
          auditProgram: {
            tenantId: tenantId
          }
        }
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    // Get attendances
    const attendances = await prisma.managementReviewAttendance.findMany({
      where: { meetingId },
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
    });

    return { attendances };
  } catch (error) {
    throw error;
  }
};

/**
 * Start Management Review Meeting
 */
const startManagementReviewMeeting = async (meetingId, userId, tenantId) => {
  try {
    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        audit: {
          auditProgram: {
            tenantId: tenantId
          }
        }
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    if (meeting.status !== 'UPCOMING') {
      throw new AppError('Meeting cannot be started. Current status: ' + meeting.status, 400);
    }

    // Update meeting status to ACTIVE
    const updatedMeeting = await prisma.managementReviewMeeting.update({
      where: { id: meetingId },
      data: { status: 'ACTIVE' },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return { meeting: updatedMeeting };
  } catch (error) {
    throw error;
  }
};

/**
 * Complete Management Review Meeting
 */
const completeManagementReviewMeeting = async (meetingId, userId, tenantId) => {
  try {
    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        audit: {
          auditProgram: {
            tenantId: tenantId
          }
        }
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    if (meeting.status !== 'ACTIVE') {
      throw new AppError('Meeting cannot be completed. Current status: ' + meeting.status, 400);
    }

    // Update meeting status to COMPLETED
    const updatedMeeting = await prisma.managementReviewMeeting.update({
      where: { id: meetingId },
      data: { status: 'COMPLETED' },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    return { meeting: updatedMeeting };
  } catch (error) {
    throw error;
  }
};

/**
 * Get Management Review Meeting by ID
 */
const getManagementReviewMeetingById = async (meetingId, tenantId) => {
  try {
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        audit: {
          auditProgram: {
            tenantId: tenantId
          }
        }
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        minutes: {
          orderBy: {
            order: 'asc'
          }
        },
        attendances: {
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
        },
        audit: {
          include: {
            auditProgram: {
              select: {
                id: true,
                title: true,
                tenantId: true
              }
            }
          }
        }
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    return { meeting };
  } catch (error) {
    throw error;
  }
};

/**
 * Get all Management Review Meetings for an audit
 */
const getManagementReviewMeetingsByAudit = async (auditId, tenantId) => {
  try {
    // Verify audit exists and belongs to tenant
    const audit = await prisma.audit.findFirst({
      where: {
        id: auditId,
        auditProgram: {
          tenantId: tenantId
        }
      }
    });

    if (!audit) {
      throw new AppError('Audit not found', 404);
    }

    const meetings = await prisma.managementReviewMeeting.findMany({
      where: {
        auditId,
        audit: {
          auditProgram: {
            tenantId: tenantId
          }
        }
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        minutes: {
          orderBy: {
            order: 'asc'
          }
        },
        attendances: {
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
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return { meetings };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  sendManagementReviewInvitation,
  checkManagementReviewInvitationStatus,
  createManagementReviewMeeting,
  getManagementReviewMeetingForAudit,
  updateManagementReviewMeeting,
  deleteManagementReviewMeeting,
  createOrUpdateMinuteItem,
  updateMinuteItem,
  deleteMinuteItem,
  createOrUpdateAttendance,
  getAttendancesByMeeting,
  startManagementReviewMeeting,
  completeManagementReviewMeeting,
  getManagementReviewMeetingById,
  getManagementReviewMeetingsByAudit,
  MANAGEMENT_REVIEW_MINUTES
}; 