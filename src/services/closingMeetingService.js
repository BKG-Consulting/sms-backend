/**
 * Closing Meeting Service
 * Handles closing meeting operations with predefined agendas
 */

const { DateTime } = require('luxon');
const { AppError } = require('../../errors/app.error');
const { logger } = require('../utils/logger');
const agendaTemplateService = require('./agendaTemplateService');
const { prisma } = require('../../prisma/client');

class ClosingMeetingService {
  /**
   * Create closing meeting with all data in a single transaction (optimized)
   * @param {Object} params - Meeting creation parameters
   * @param {Array} params.attendance - Initial attendance data
   * @param {Array} params.agendas - Custom agenda data
   * @returns {Object} Created meeting with full details
   */
  async createClosingMeetingWithData({
    auditId,
    createdById,
    scheduledAtLocal,
    timeZone,
    venue,
    notes,
    attendance = [],
    agendas = []
  }) {
    try {
      // Validate required parameters
      if (!auditId || !createdById) {
        throw new AppError('Missing required fields: auditId, createdById', 400);
      }

      // Check if closing meeting already exists for this audit
      const existing = await prisma.closingMeeting.findFirst({
        where: { 
          auditId, 
          archived: false 
        }
      });

      if (existing) {
        throw new AppError('Closing meeting already exists for this audit', 409);
      }

      // Convert local time to UTC
      let scheduledAtUtc;
      if (scheduledAtLocal && timeZone) {
        const dt = DateTime.fromISO(scheduledAtLocal, { zone: timeZone });
        if (!dt.isValid) {
          throw new AppError('Invalid scheduledAtLocal or timeZone', 400);
        }
        scheduledAtUtc = dt.toUTC().toJSDate();
      } else {
        scheduledAtUtc = new Date();
      }

      // Get audit details
      const audit = await prisma.audit.findUnique({
        where: { id: auditId },
        include: {
          auditProgram: {
            select: {
              id: true,
              title: true,
              tenantId: true
            }
          }
        }
      });

      if (!audit) {
        throw new AppError('Audit not found', 404);
      }

      // Get agenda template for closing meetings
      const agendaTemplate = await agendaTemplateService.getAgendaTemplate('CLOSING', audit.auditProgram.tenantId);
      
      if (!agendaTemplate) {
        throw new AppError('Closing meeting agenda template not found. Please contact administrator.', 404);
      }

      // Create meeting with all related data in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create the closing meeting
        const meeting = await tx.closingMeeting.create({
          data: {
            auditId,
            scheduledAt: scheduledAtUtc,
            createdById,
            notes: notes || null,
            venue: venue || null,
            status: 'ACTIVE',
            archived: false
          }
        });

        // 2. Create agenda items (use provided agendas or template)
        const agendaData = agendas.length > 0 
          ? agendas.map((agenda, index) => ({
              meetingId: meeting.id,
              agendaText: agenda.agendaText,
              order: agenda.order || index + 1,
              discussed: agenda.discussed || false,
              notes: agenda.notes || null
            }))
          : agendaTemplate.items.map((item) => ({
              meetingId: meeting.id,
              agendaText: item.agendaText,
              order: item.order,
              discussed: false,
              notes: null
            }));

        if (agendaData.length > 0) {
          await tx.closingMeetingAgenda.createMany({
            data: agendaData
          });
        }

        // 3. Create attendance records if provided
        if (attendance.length > 0) {
          const attendanceData = attendance.map(att => ({
            meetingId: meeting.id,
            userId: att.userId,
            present: att.present || false,
            remarks: att.remarks || null
          }));

          await tx.closingMeetingAttendance.createMany({
            data: attendanceData
          });
        }

        // 4. Create audit log entry
        await tx.auditLog.create({
          data: {
            action: 'CREATE_CLOSING_MEETING',
            entityType: 'CLOSING_MEETING',
            entityId: meeting.id,
            userId: createdById,
            tenantId: audit.auditProgram.tenantId,
            details: `Created closing meeting for audit ${audit.auditNo} (${audit.auditProgram.title})`,
            metadata: {
              auditId,
              meetingId: meeting.id,
              scheduledAt: scheduledAtUtc.toISOString(),
              venue: venue || null,
              agendaCount: agendaData.length,
              attendanceCount: attendance.length
            }
          }
        });

        return meeting;
      });

      // Fetch the complete meeting with all relations
      const completeMeeting = await this.getClosingMeetingById(result.id);

      logger.info('Closing meeting created successfully with all data', {
        meetingId: result.id,
        auditId,
        createdById,
        agendaCount: agendas.length || agendaTemplate.items.length,
        attendanceCount: attendance.length
      });

      return completeMeeting;

    } catch (error) {
      logger.error('Error creating closing meeting with data:', error);
      throw error;
    }
  }

  /**
   * Create closing meeting with user-provided data (clean approach)
   * @param {Object} params - Meeting creation parameters
   * @param {string} params.auditId - The audit ID
   * @param {string} params.createdById - The user creating the meeting
   * @param {string} params.scheduledAtLocal - Local scheduled time
   * @param {string} params.timeZone - Timezone
   * @param {string} params.venue - Meeting venue
   * @param {string} params.notes - Meeting notes
   * @param {Array} params.agendas - User-provided agenda items
   * @param {Array} params.attendance - User-provided attendance data
   * @returns {Object} Created meeting with full details
   */
  async createClosingMeetingUserDriven({
    auditId,
    createdById,
    scheduledAtLocal,
    timeZone,
    venue,
    notes,
    agendas = [],
    attendance = []
  }) {
    try {
      // Validate required parameters
      if (!auditId || !createdById) {
        throw new AppError('Missing required fields: auditId, createdById', 400);
      }

      // Check if closing meeting already exists for this audit
      const existing = await prisma.closingMeeting.findFirst({
        where: { 
          auditId, 
          archived: false 
        }
      });

      if (existing) {
        throw new AppError('Closing meeting already exists for this audit', 409);
      }

      // Convert local time to UTC
      let scheduledAtUtc;
      if (scheduledAtLocal && timeZone) {
        const dt = DateTime.fromISO(scheduledAtLocal, { zone: timeZone });
        if (!dt.isValid) {
          throw new AppError('Invalid scheduledAtLocal or timeZone', 400);
        }
        scheduledAtUtc = dt.toUTC().toJSDate();
      } else {
        scheduledAtUtc = new Date();
      }

      // Get audit details
      const audit = await prisma.audit.findUnique({
        where: { id: auditId },
        include: {
          auditProgram: {
            select: {
              id: true,
              title: true,
              tenantId: true
            }
          }
        }
      });

      if (!audit) {
        throw new AppError('Audit not found', 404);
      }

      // Create meeting with all user-provided data in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create the closing meeting
        const meeting = await tx.closingMeeting.create({
          data: {
            auditId,
            scheduledAt: scheduledAtUtc,
            createdById,
            notes: notes || null,
            venue: venue || null,
            status: 'ACTIVE',
            archived: false
          }
        });

        // 2. Create user-provided agenda items
        if (agendas.length > 0) {
          const agendaData = agendas.map((agenda, index) => ({
            meetingId: meeting.id,
            agendaText: agenda.agendaText,
            order: agenda.order || index + 1,
            discussed: agenda.discussed || false,
            notes: agenda.notes || null
          }));

          await tx.closingMeetingAgenda.createMany({
            data: agendaData
          });
        }

        // 3. Create user-provided attendance records
        if (attendance.length > 0) {
          const attendanceData = attendance.map(att => ({
            meetingId: meeting.id,
            userId: att.userId,
            present: att.present || false,
            remarks: att.remarks || null
          }));

          await tx.closingMeetingAttendance.createMany({
            data: attendanceData
          });
        }

        // 4. Create audit log entry
        await tx.auditLog.create({
          data: {
            action: 'CREATE_CLOSING_MEETING',
            entityType: 'CLOSING_MEETING',
            entityId: meeting.id,
            userId: createdById,
            tenantId: audit.auditProgram.tenantId,
            details: `Created closing meeting for audit ${audit.auditNo} (${audit.auditProgram.title})`,
            metadata: {
              auditId,
              meetingId: meeting.id,
              scheduledAt: scheduledAtUtc.toISOString(),
              venue: venue || null,
              agendaCount: agendas.length,
              attendanceCount: attendance.length
            }
          }
        });

        return meeting;
      });

      // Fetch the complete meeting with all relations
      const completeMeeting = await this.getClosingMeetingById(result.id);

      logger.info('Closing meeting created successfully (user-driven)', {
        meetingId: result.id,
        auditId,
        createdById,
        agendaCount: agendas.length,
        attendanceCount: attendance.length
      });

      return completeMeeting;

    } catch (error) {
      logger.error('Error creating closing meeting (user-driven):', error);
      throw error;
    }
  }

  /**
   * Get closing meeting by ID with full details
   * @param {string} meetingId - The meeting ID
   * @returns {Object} Meeting with full details
   */
  async getClosingMeetingById(meetingId) {
    try {
      const meeting = await prisma.closingMeeting.findUnique({
        where: { id: meetingId },
        include: {
          audit: {
            include: {
              auditProgram: {
                select: {
                  id: true,
                  title: true,
                  tenantId: true
                }
              },
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
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          agendas: {
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

      if (!meeting) {
        throw new AppError('Closing meeting not found', 404);
      }

      return meeting;
    } catch (error) {
      logger.error('Error getting closing meeting by ID:', error);
      throw error;
    }
  }

  /**
   * Get closing meeting by audit ID
   * @param {string} auditId - The audit ID
   * @returns {Object} Meeting with full details
   */
  async getClosingMeetingByAudit(auditId) {
    try {
      const meeting = await prisma.closingMeeting.findFirst({
        where: { 
          auditId, 
          archived: false 
        },
        include: {
          audit: {
            include: {
              auditProgram: {
                select: {
                  id: true,
                  title: true,
                  tenantId: true
                }
              },
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
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          agendas: {
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

      return meeting;
    } catch (error) {
      logger.error('Error getting closing meeting by audit:', error);
      throw error;
    }
  }

  /**
   * Update attendance for a closing meeting
   * @param {string} meetingId - The meeting ID
   * @param {string} userId - The user ID
   * @param {boolean} present - Whether the user is present
   * @param {string} remarks - Optional remarks
   * @param {string} updatedBy - User updating the attendance
   * @returns {Object} Updated attendance
   */
  async updateAttendance(meetingId, userId, present, remarks, updatedBy) {
    try {
      const meeting = await prisma.closingMeeting.findUnique({
        where: { id: meetingId },
        include: {
          audit: {
            select: {
              auditProgram: {
                select: { tenantId: true }
              }
            }
          }
        }
      });

      if (!meeting) {
        throw new AppError('Closing meeting not found', 404);
      }

      const attendance = await prisma.closingMeetingAttendance.upsert({
        where: {
          meetingId_userId: {
            meetingId,
            userId
          }
        },
        update: {
          present,
          remarks: remarks || null,
          updatedAt: new Date()
        },
        create: {
          meetingId,
          userId,
          present,
          remarks: remarks || null
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'UPDATE_CLOSING_MEETING_ATTENDANCE',
          entityType: 'CLOSING_MEETING_ATTENDANCE',
          entityId: attendance.id,
          userId: updatedBy,
          tenantId: meeting.audit.auditProgram.tenantId,
          details: `Updated attendance for user ${userId} in closing meeting ${meetingId}`,
          metadata: {
            meetingId,
            userId,
            present,
            remarks: remarks || null,
            updatedBy
          }
        }
      });

      return attendance;
    } catch (error) {
      logger.error('Error updating closing meeting attendance:', error);
      throw error;
    }
  }

  /**
   * Update agenda item discussion status
   * @param {string} agendaId - The agenda ID
   * @param {boolean} discussed - Whether the item was discussed
   * @param {string} notes - Optional notes
   * @param {string} updatedBy - User updating the agenda
   * @returns {Object} Updated agenda item
   */
  async updateAgendaDiscussed(agendaId, discussed, notes, updatedBy) {
    try {
      const agenda = await prisma.closingMeetingAgenda.findUnique({
        where: { id: agendaId },
        include: {
          meeting: {
            include: {
              audit: {
                select: {
                  auditProgram: {
                    select: { tenantId: true }
                  }
                }
              }
            }
          }
        }
      });

      if (!agenda) {
        throw new AppError('Agenda item not found', 404);
      }

      const updatedAgenda = await prisma.closingMeetingAgenda.update({
        where: { id: agendaId },
        data: {
          discussed,
          notes: notes || null,
          updatedAt: new Date()
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'UPDATE_CLOSING_MEETING_AGENDA',
          entityType: 'CLOSING_MEETING_AGENDA',
          entityId: agendaId,
          userId: updatedBy,
          tenantId: agenda.meeting.audit.auditProgram.tenantId,
          details: `Updated agenda item ${agendaId} in closing meeting ${agenda.meetingId}`,
          metadata: {
            agendaId,
            meetingId: agenda.meetingId,
            discussed,
            notes: notes || null,
            updatedBy
          }
        }
      });

      return updatedAgenda;
    } catch (error) {
      logger.error('Error updating closing meeting agenda:', error);
      throw error;
    }
  }

  /**
   * Start a closing meeting
   * @param {string} meetingId - The meeting ID
   * @param {string} startedBy - User starting the meeting
   * @returns {Object} Updated meeting
   */
  async startMeeting(meetingId, startedBy) {
    try {
      const meeting = await prisma.closingMeeting.findUnique({
        where: { id: meetingId },
        include: {
          audit: {
            select: {
              auditProgram: {
                select: { tenantId: true }
              }
            }
          }
        }
      });

      if (!meeting) {
        throw new AppError('Closing meeting not found', 404);
      }

      if (meeting.status !== 'UPCOMING') {
        throw new AppError('Meeting cannot be started. Current status: ' + meeting.status, 400);
      }

      const updatedMeeting = await prisma.closingMeeting.update({
        where: { id: meetingId },
        data: {
          status: 'ACTIVE',
          updatedAt: new Date()
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'START_CLOSING_MEETING',
          entityType: 'CLOSING_MEETING',
          entityId: meetingId,
          userId: startedBy,
          tenantId: meeting.audit.auditProgram.tenantId,
          details: `Started closing meeting ${meetingId}`,
          metadata: {
            meetingId,
            startedBy,
            startedAt: new Date().toISOString()
          }
        }
      });

      return updatedMeeting;
    } catch (error) {
      logger.error('Error starting closing meeting:', error);
      throw error;
    }
  }

  /**
   * Complete a closing meeting
   * @param {string} meetingId - The meeting ID
   * @param {string} completedBy - User completing the meeting
   * @returns {Object} Updated meeting
   */
  async completeMeeting(meetingId, completedBy) {
    try {
      const meeting = await prisma.closingMeeting.findUnique({
        where: { id: meetingId },
        include: {
          audit: {
            select: {
              auditProgram: {
                select: { tenantId: true }
              }
            }
          }
        }
      });

      if (!meeting) {
        throw new AppError('Closing meeting not found', 404);
      }

      if (meeting.status !== 'ACTIVE') {
        throw new AppError('Meeting cannot be completed. Current status: ' + meeting.status, 400);
      }

      const updatedMeeting = await prisma.closingMeeting.update({
        where: { id: meetingId },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date()
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'COMPLETE_CLOSING_MEETING',
          entityType: 'CLOSING_MEETING',
          entityId: meetingId,
          userId: completedBy,
          tenantId: meeting.audit.auditProgram.tenantId,
          details: `Completed closing meeting ${meetingId}`,
          metadata: {
            meetingId,
            completedBy,
            completedAt: new Date().toISOString()
          }
        }
      });

      return updatedMeeting;
    } catch (error) {
      logger.error('Error completing closing meeting:', error);
      throw error;
    }
  }

  /**
   * Get closing meeting attendees based on role permissions
   * @param {string} auditId - The audit ID
   * @param {string} tenantId - The tenant ID
   * @returns {Array} Array of attendees with user details
   */
  async getClosingMeetingAttendees(auditId, tenantId) {
    try {
      // Get users with Closing Meeting:attend permission
      const usersWithPermission = await prisma.user.findMany({
        where: {
          tenantId: tenantId,
          userRoles: {
            some: {
              role: {
                rolePermissions: {
                  some: {
                    permission: {
                      module: 'Closing Meeting',
                      action: 'attend'
                    },
                    allowed: true
                  }
                }
              }
            }
          }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          userRoles: {
            select: {
              role: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });

      const attendees = usersWithPermission.map(user => {
        // Get the first role as fallback
        const defaultRole = user.userRoles[0]?.role?.name || 'USER';
        
        return {
          userId: user.id,
          role: defaultRole,
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
          }
        };
      });

      return attendees;
    } catch (error) {
      logger.error('Error getting closing meeting attendees:', error);
      throw new AppError('Failed to get closing meeting attendees', 500);
    }
  }

  /**
   * Update meeting notes
   * @param {string} meetingId - The meeting ID
   * @param {string} notes - The meeting notes
   * @param {string} updatedBy - User updating the notes
   * @returns {Object} Updated meeting
   */
  async updateMeetingNotes(meetingId, notes, updatedBy) {
    try {
      const meeting = await prisma.closingMeeting.findUnique({
        where: { id: meetingId },
        include: {
          audit: {
            select: {
              auditProgram: {
                select: { tenantId: true }
              }
            }
          }
        }
      });

      if (!meeting) {
        throw new AppError('Closing meeting not found', 404);
      }

      const updatedMeeting = await prisma.closingMeeting.update({
        where: { id: meetingId },
        data: {
          notes: notes || null,
          updatedAt: new Date()
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'UPDATE_CLOSING_MEETING_NOTES',
          entityType: 'CLOSING_MEETING',
          entityId: meetingId,
          userId: updatedBy,
          tenantId: meeting.audit.auditProgram.tenantId,
          details: `Updated notes for closing meeting ${meetingId}`,
          metadata: {
            meetingId,
            updatedBy,
            updatedAt: new Date().toISOString()
          }
        }
      });

      return updatedMeeting;

    } catch (error) {
      logger.error('Error updating closing meeting notes:', error);
      throw error;
    }
  }

  /**
   * Archive a closing meeting (soft delete)
   * @param {string} meetingId - The meeting ID
   * @param {string} archivedBy - User archiving the meeting
   * @returns {Object} Updated meeting
   */
  async archiveMeeting(meetingId, archivedBy) {
    try {
      const meeting = await prisma.closingMeeting.findUnique({
        where: { id: meetingId },
        include: {
          audit: {
            select: {
              auditProgram: {
                select: { tenantId: true }
              }
            }
          }
        }
      });

      if (!meeting) {
        throw new AppError('Closing meeting not found', 404);
      }

      if (meeting.archived) {
        throw new AppError('Meeting is already archived', 400);
      }

      const updatedMeeting = await prisma.closingMeeting.update({
        where: { id: meetingId },
        data: {
          archived: true,
          updatedAt: new Date()
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'ARCHIVE_CLOSING_MEETING',
          entityType: 'CLOSING_MEETING',
          entityId: meetingId,
          userId: archivedBy,
          tenantId: meeting.audit.auditProgram.tenantId,
          details: `Archived closing meeting ${meetingId}`,
          metadata: {
            meetingId,
            archivedBy,
            archivedAt: new Date().toISOString()
          }
        }
      });

      return updatedMeeting;

    } catch (error) {
      logger.error('Error archiving closing meeting:', error);
      throw error;
    }
  }

  /**
   * Batch update closing meeting with all related data
   * @param {string} meetingId - The meeting ID
   * @param {Object} data - Update data
   * @param {Array} data.attendance - Updated attendance data
   * @param {Array} data.agendas - Updated agenda data
   * @param {string} updatedBy - User updating the meeting
   * @returns {Object} Updated meeting with full details
   */
  async batchUpdateClosingMeeting(meetingId, data, updatedBy) {
    try {
      const meeting = await prisma.closingMeeting.findUnique({
        where: { id: meetingId },
        include: {
          audit: {
            select: {
              auditProgram: {
                select: { tenantId: true }
              }
            }
          }
        }
      });

      if (!meeting) {
        throw new AppError('Closing meeting not found', 404);
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Update meeting basic info
        const updatedMeeting = await tx.closingMeeting.update({
          where: { id: meetingId },
          data: {
            notes: data.notes !== undefined ? data.notes : undefined,
            venue: data.venue !== undefined ? data.venue : undefined,
            status: data.status !== undefined ? data.status : undefined,
            updatedAt: new Date()
          }
        });

        // 2. Update attendance if provided
        if (data.attendance && Array.isArray(data.attendance)) {
          // Delete existing attendance
          await tx.closingMeetingAttendance.deleteMany({
            where: { meetingId }
          });

          // Create new attendance records
          if (data.attendance.length > 0) {
            const attendanceData = data.attendance.map(att => ({
              meetingId,
              userId: att.userId,
              present: att.present || false,
              remarks: att.remarks || null
            }));

            await tx.closingMeetingAttendance.createMany({
              data: attendanceData
            });
          }
        }

        // 3. Update agenda items if provided
        if (data.agendas && Array.isArray(data.agendas)) {
          // Delete existing agenda items
          await tx.closingMeetingAgenda.deleteMany({
            where: { meetingId }
          });

          // Create new agenda items
          if (data.agendas.length > 0) {
            const agendaData = data.agendas.map((agenda, index) => ({
              meetingId,
              agendaText: agenda.agendaText,
              order: agenda.order || index + 1,
              discussed: agenda.discussed || false,
              notes: agenda.notes || null
            }));

            await tx.closingMeetingAgenda.createMany({
              data: agendaData
            });
          }
        }

        // 4. Create audit log
        await tx.auditLog.create({
          data: {
            action: 'BATCH_UPDATE_CLOSING_MEETING',
            entityType: 'CLOSING_MEETING',
            entityId: meetingId,
            userId: updatedBy,
            tenantId: meeting.audit.auditProgram.tenantId,
            details: `Batch updated closing meeting ${meetingId}`,
            metadata: {
              meetingId,
              updatedBy,
              updatedAt: new Date().toISOString(),
              attendanceCount: data.attendance?.length || 0,
              agendaCount: data.agendas?.length || 0
            }
          }
        });

        return updatedMeeting;
      });

      // Fetch the complete updated meeting
      const completeMeeting = await this.getClosingMeetingById(meetingId);

      logger.info('Closing meeting batch updated successfully', {
        meetingId,
        updatedBy,
        attendanceCount: data.attendance?.length || 0,
        agendaCount: data.agendas?.length || 0
      });

      return completeMeeting;

    } catch (error) {
      logger.error('Error batch updating closing meeting:', error);
      throw error;
    }
  }

  /**
   * Get default closing meeting agendas (for UI suggestions)
   * @param {string} tenantId - The tenant ID
   * @returns {Array} Default agenda suggestions
   */
  async getDefaultClosingAgendas(tenantId) {
    try {
      // Get agenda template for suggestions
      const agendaTemplate = await agendaTemplateService.getAgendaTemplate('CLOSING', tenantId);
      
      if (agendaTemplate) {
        return agendaTemplate.items.map((item, index) => ({
          agendaText: item.agendaText,
          order: index + 1,
          discussed: false,
          notes: null
        }));
      }

      // Return default agendas if no template exists
      return [
        {
          agendaText: "Summary of audit findings and observations",
          order: 1,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Discussion of identified risks and control weaknesses",
          order: 2,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Recommendations and action items",
          order: 3,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Management response and commitments",
          order: 4,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Timeline for implementing recommendations",
          order: 5,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Next steps and follow-up procedures",
          order: 6,
          discussed: false,
          notes: null
        }
      ];
    } catch (error) {
      logger.error('Error getting default closing agendas:', error);
      // Return basic defaults on error
      return [
        {
          agendaText: "Audit findings summary",
          order: 1,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Recommendations and action items",
          order: 2,
          discussed: false,
          notes: null
        }
      ];
    }
  }
}

module.exports = new ClosingMeetingService(); 