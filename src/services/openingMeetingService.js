/**
 * Opening Meeting Service
 * Handles opening meeting operations with predefined agendas
 */

const { DateTime } = require('luxon');
const { AppError } = require('../../errors/app.error');
const { logger } = require('../utils/logger');
const agendaTemplateService = require('./agendaTemplateService');
const { prisma } = require('../../prisma/client');

class OpeningMeetingService {
  /**
   * Create a new opening meeting for an audit
   * @param {Object} params - Meeting creation parameters
   * @param {string} params.auditId - The audit ID
   * @param {string} params.createdById - The user creating the meeting
   * @param {string} params.scheduledAtLocal - Local scheduled time
   * @param {string} params.timeZone - Timezone
   * @param {string} params.venue - Meeting venue
   * @param {string} params.notes - Meeting notes
   * @param {Array} params.attendance - Initial attendance data
   * @returns {Object} Created meeting with full details
   */
  async createOpeningMeeting({
    auditId,
    createdById,
    scheduledAtLocal,
    timeZone,
    venue,
    notes
  }) {
    try {
      // Validate required parameters
      if (!auditId || !createdById) {
        throw new AppError('Missing required fields: auditId, createdById', 400);
      }

      // Check if opening meeting already exists for this audit
      const existing = await prisma.openingMeeting.findFirst({
        where: { 
          auditId, 
          archived: false 
        }
      });

      if (existing) {
        throw new AppError('Opening meeting already exists for this audit', 409);
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
      });

      if (!audit) {
        throw new AppError('Audit not found', 404);
      }

      // Get agenda template for opening meetings
      const agendaTemplate = await agendaTemplateService.getAgendaTemplate('OPENING', audit.auditProgram.tenantId);
      
      if (!agendaTemplate) {
        throw new AppError('Opening meeting agenda template not found. Please contact administrator.', 404);
      }

      // Create meeting with predefined agendas in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create the opening meeting
        const meeting = await tx.openingMeeting.create({
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

        // 2. Create predefined agenda items from template
        const agendaData = agendaTemplate.items.map((item) => ({
          meetingId: meeting.id,
          agendaText: item.agendaText,
          order: item.order,
          discussed: false
        }));

        await tx.openingMeetingAgenda.createMany({
          data: agendaData
        });



        // 4. Create audit log entry
        await tx.auditLog.create({
          data: {
            action: 'CREATE_OPENING_MEETING',
            entityType: 'OPENING_MEETING',
            entityId: meeting.id,
            userId: createdById,
            tenantId: audit.auditProgram.tenantId,
            details: `Created opening meeting for audit ${audit.auditNo} (${audit.auditProgram.title})`,
            metadata: {
              auditId,
              meetingId: meeting.id,
              scheduledAt: scheduledAtUtc.toISOString(),
              venue: venue || null
            }
          }
        });

        return meeting;
      });

      // Fetch the complete meeting with all relations
      const completeMeeting = await this.getOpeningMeetingById(result.id);

      logger.info('Opening meeting created successfully', {
        meetingId: result.id,
        auditId,
        createdById,
        agendaCount: agendaTemplate.items.length
      });

      return completeMeeting;

    } catch (error) {
      logger.error('Error creating opening meeting:', error);
      throw error;
    }
  }

  /**
   * Create opening meeting with all data in a single transaction (optimized)
   * @param {Object} params - Meeting creation parameters
   * @param {Array} params.attendance - Initial attendance data
   * @param {Array} params.agendas - Custom agenda data
   * @returns {Object} Created meeting with full details
   */
  async createOpeningMeetingWithData({
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

      // Check if opening meeting already exists for this audit
      const existing = await prisma.openingMeeting.findFirst({
        where: { 
          auditId, 
          archived: false 
        }
      });

      if (existing) {
        throw new AppError('Opening meeting already exists for this audit', 409);
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

      // Get agenda template for opening meetings
      const agendaTemplate = await agendaTemplateService.getAgendaTemplate('OPENING', audit.auditProgram.tenantId);
      
      if (!agendaTemplate) {
        throw new AppError('Opening meeting agenda template not found. Please contact administrator.', 404);
      }

      // Create meeting with all related data in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        // 1. Create the opening meeting
        const meeting = await tx.openingMeeting.create({
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
          await tx.openingMeetingAgenda.createMany({
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

          await tx.openingMeetingAttendance.createMany({
            data: attendanceData
          });
        }

        // 4. Create audit log entry
        await tx.auditLog.create({
          data: {
            action: 'CREATE_OPENING_MEETING',
            entityType: 'OPENING_MEETING',
            entityId: meeting.id,
            userId: createdById,
            tenantId: audit.auditProgram.tenantId,
            details: `Created opening meeting for audit ${audit.auditNo} (${audit.auditProgram.title})`,
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
      const completeMeeting = await this.getOpeningMeetingById(result.id);

      logger.info('Opening meeting created successfully with all data', {
        meetingId: result.id,
        auditId,
        createdById,
        agendaCount: agendas.length || agendaTemplate.items.length,
        attendanceCount: attendance.length
      });

      return completeMeeting;

    } catch (error) {
      logger.error('Error creating opening meeting with data:', error);
      throw error;
    }
  }

  /**
   * Create opening meeting with user-provided data (clean approach)
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
  async createOpeningMeetingUserDriven({
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

      // Check if opening meeting already exists for this audit
      const existing = await prisma.openingMeeting.findFirst({
        where: { 
          auditId, 
          archived: false 
        }
      });

      if (existing) {
        throw new AppError('Opening meeting already exists for this audit', 409);
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
        // 1. Create the opening meeting
        const meeting = await tx.openingMeeting.create({
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

          await tx.openingMeetingAgenda.createMany({
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

          await tx.openingMeetingAttendance.createMany({
            data: attendanceData
          });
        }

        // 4. Create audit log entry
        await tx.auditLog.create({
          data: {
            action: 'CREATE_OPENING_MEETING',
            entityType: 'OPENING_MEETING',
            entityId: meeting.id,
            userId: createdById,
            tenantId: audit.auditProgram.tenantId,
            details: `Created opening meeting for audit ${audit.auditNo} (${audit.auditProgram.title})`,
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
      const completeMeeting = await this.getOpeningMeetingById(result.id);

      logger.info('Opening meeting created successfully (user-driven)', {
        meetingId: result.id,
        auditId,
        createdById,
        agendaCount: agendas.length,
        attendanceCount: attendance.length
      });

      return completeMeeting;

    } catch (error) {
      logger.error('Error creating opening meeting (user-driven):', error);
      throw error;
    }
  }

  /**
   * Get opening meeting by ID with full details
   * @param {string} meetingId - The meeting ID
   * @returns {Object} Meeting with full details
   */
  async getOpeningMeetingById(meetingId) {
    try {
      const meeting = await prisma.openingMeeting.findUnique({
        where: { id: meetingId },
        include: {
          audit: {
            select: {
              id: true,
              auditNo: true,
              type: true,
              auditProgram: {
                select: {
                  id: true,
                  title: true,
                  status: true
                }
              },
              teamMembers: {
                select: {
                  userId: true,
                  role: true,
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
            orderBy: { order: 'asc' }
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
        throw new AppError('Opening meeting not found', 404);
      }

      return meeting;

    } catch (error) {
      logger.error('Error fetching opening meeting:', error);
      throw error;
    }
  }

  /**
   * Get opening meeting for a specific audit
   * @param {string} auditId - The audit ID
   * @returns {Object|null} Meeting or null if not found
   */
  async getOpeningMeetingByAudit(auditId) {
    try {
      const meeting = await prisma.openingMeeting.findFirst({
        where: { 
          auditId, 
          archived: false 
        },
        include: {
          audit: {
            select: {
              id: true,
              auditNo: true,
              type: true,
              auditProgram: {
                select: {
                  id: true,
                  title: true,
                  status: true
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
            orderBy: { order: 'asc' }
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
      logger.error('Error fetching opening meeting by audit:', error);
      throw error;
    }
  }

  /**
   * Update opening meeting attendance
   * @param {string} meetingId - The meeting ID
   * @param {string} userId - The user ID
   * @param {boolean} present - Whether user is present
   * @param {string} remarks - Optional remarks
   * @param {string} updatedBy - User updating the attendance
   * @returns {Object} Updated attendance record
   */
  async updateAttendance(meetingId, userId, present, remarks, updatedBy) {
    try {
      // Check if meeting exists
      const meeting = await prisma.openingMeeting.findUnique({
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
        throw new AppError('Opening meeting not found', 404);
      }

      // Update or create attendance record
      const attendance = await prisma.openingMeetingAttendance.upsert({
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
          action: 'UPDATE_OPENING_MEETING_ATTENDANCE',
          entityType: 'OPENING_MEETING_ATTENDANCE',
          entityId: attendance.id,
          userId: updatedBy,
          tenantId: meeting.audit.auditProgram.tenantId,
          details: `Updated attendance for opening meeting ${meetingId}`,
          metadata: {
            meetingId,
            userId,
            present,
            updatedBy
          }
        }
      });

      return attendance;

    } catch (error) {
      logger.error('Error updating opening meeting attendance:', error);
      throw error;
    }
  }

  /**
   * Update agenda item discussion status
   * @param {string} agendaId - The agenda item ID
   * @param {boolean} discussed - Whether the item was discussed
   * @param {string} notes - Optional notes about the discussion
   * @param {string} updatedBy - User updating the agenda
   * @returns {Object} Updated agenda item
   */
  async updateAgendaDiscussed(agendaId, discussed, notes, updatedBy) {
    try {
      const agenda = await prisma.openingMeetingAgenda.findUnique({
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

      const updatedAgenda = await prisma.openingMeetingAgenda.update({
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
          action: 'UPDATE_OPENING_MEETING_AGENDA',
          entityType: 'OPENING_MEETING_AGENDA',
          entityId: agendaId,
          userId: updatedBy,
          tenantId: agenda.meeting.audit.auditProgram.tenantId,
          details: `Updated agenda item discussion status for opening meeting`,
          metadata: {
            agendaId,
            discussed,
            meetingId: agenda.meetingId,
            updatedBy
          }
        }
      });

      return updatedAgenda;

    } catch (error) {
      logger.error('Error updating opening meeting agenda:', error);
      throw error;
    }
  }

  /**
   * Start an opening meeting
   * @param {string} meetingId - The meeting ID
   * @param {string} startedBy - User starting the meeting
   * @returns {Object} Updated meeting
   */
  async startMeeting(meetingId, startedBy) {
    try {
      const meeting = await prisma.openingMeeting.findUnique({
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
        throw new AppError('Opening meeting not found', 404);
      }

      if (meeting.status === 'ACTIVE') {
        throw new AppError('Meeting is already active', 400);
      }

      if (meeting.status === 'COMPLETED') {
        throw new AppError('Cannot start a completed meeting', 400);
      }

      const updatedMeeting = await prisma.openingMeeting.update({
        where: { id: meetingId },
        data: {
          status: 'ACTIVE',
          updatedAt: new Date()
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'START_OPENING_MEETING',
          entityType: 'OPENING_MEETING',
          entityId: meetingId,
          userId: startedBy,
          tenantId: meeting.audit.auditProgram.tenantId,
          details: `Started opening meeting ${meetingId}`,
          metadata: {
            meetingId,
            startedBy,
            startedAt: new Date().toISOString()
          }
        }
      });

      return updatedMeeting;

    } catch (error) {
      logger.error('Error starting opening meeting:', error);
      throw error;
    }
  }

  /**
   * Complete an opening meeting
   * @param {string} meetingId - The meeting ID
   * @param {string} completedBy - User completing the meeting
   * @returns {Object} Updated meeting
   */
  async completeMeeting(meetingId, completedBy) {
    try {
      const meeting = await prisma.openingMeeting.findUnique({
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
        throw new AppError('Opening meeting not found', 404);
      }

      if (meeting.status === 'COMPLETED') {
        throw new AppError('Meeting is already completed', 400);
      }

      const updatedMeeting = await prisma.openingMeeting.update({
        where: { id: meetingId },
        data: {
          status: 'COMPLETED',
          updatedAt: new Date()
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'COMPLETE_OPENING_MEETING',
          entityType: 'OPENING_MEETING',
          entityId: meetingId,
          userId: completedBy,
          tenantId: meeting.audit.auditProgram.tenantId,
          details: `Completed opening meeting ${meetingId}`,
          metadata: {
            meetingId,
            completedBy,
            completedAt: new Date().toISOString()
          }
        }
      });

      return updatedMeeting;

    } catch (error) {
      logger.error('Error completing opening meeting:', error);
      throw error;
    }
  }

  /**
   * Batch update opening meeting with all related data
   * @param {string} meetingId - The meeting ID
   * @param {Object} data - Update data
   * @param {Array} data.attendance - Updated attendance data
   * @param {Array} data.agendas - Updated agenda data
   * @param {string} updatedBy - User updating the meeting
   * @returns {Object} Updated meeting with full details
   */
  async batchUpdateOpeningMeeting(meetingId, data, updatedBy) {
    try {
      const meeting = await prisma.openingMeeting.findUnique({
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
        throw new AppError('Opening meeting not found', 404);
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Update meeting basic info
        const updatedMeeting = await tx.openingMeeting.update({
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
          await tx.openingMeetingAttendance.deleteMany({
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

            await tx.openingMeetingAttendance.createMany({
              data: attendanceData
            });
          }
        }

        // 3. Update agenda items if provided
        if (data.agendas && Array.isArray(data.agendas)) {
          // Delete existing agenda items
          await tx.openingMeetingAgenda.deleteMany({
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

            await tx.openingMeetingAgenda.createMany({
              data: agendaData
            });
          }
        }

        // 4. Create audit log
        await tx.auditLog.create({
          data: {
            action: 'BATCH_UPDATE_OPENING_MEETING',
            entityType: 'OPENING_MEETING',
            entityId: meetingId,
            userId: updatedBy,
            tenantId: meeting.audit.auditProgram.tenantId,
            details: `Batch updated opening meeting ${meetingId}`,
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
      const completeMeeting = await this.getOpeningMeetingById(meetingId);

      logger.info('Opening meeting batch updated successfully', {
        meetingId,
        updatedBy,
        attendanceCount: data.attendance?.length || 0,
        agendaCount: data.agendas?.length || 0
      });

      return completeMeeting;

    } catch (error) {
      logger.error('Error batch updating opening meeting:', error);
      throw error;
    }
  }

  /**
   * Get opening meeting attendees based on role permissions
   * @param {string} auditId - The audit ID
   * @param {string} tenantId - The tenant ID
   * @returns {Array} Array of attendees with user details
   */
  async getOpeningMeetingAttendees(auditId, tenantId) {
    try {
      // Get users with Opening Meeting:attend permission
      const usersWithPermission = await prisma.user.findMany({
        where: {
          tenantId: tenantId,
          userRoles: {
            some: {
              role: {
                rolePermissions: {
                  some: {
                    permission: {
                      module: 'Opening Meeting',
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
      logger.error('Error getting opening meeting attendees:', error);
      throw new AppError('Failed to get opening meeting attendees', 500);
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
      const meeting = await prisma.openingMeeting.findUnique({
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
        throw new AppError('Opening meeting not found', 404);
      }

      const updatedMeeting = await prisma.openingMeeting.update({
        where: { id: meetingId },
        data: {
          notes: notes || null,
          updatedAt: new Date()
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'UPDATE_OPENING_MEETING_NOTES',
          entityType: 'OPENING_MEETING',
          entityId: meetingId,
          userId: updatedBy,
          tenantId: meeting.audit.auditProgram.tenantId,
          details: `Updated notes for opening meeting ${meetingId}`,
          metadata: {
            meetingId,
            updatedBy,
            updatedAt: new Date().toISOString()
          }
        }
      });

      return updatedMeeting;

    } catch (error) {
      logger.error('Error updating opening meeting notes:', error);
      throw error;
    }
  }

  /**
   * Archive an opening meeting (soft delete)
   * @param {string} meetingId - The meeting ID
   * @param {string} archivedBy - User archiving the meeting
   * @returns {Object} Updated meeting
   */
  async archiveMeeting(meetingId, archivedBy) {
    try {
      const meeting = await prisma.openingMeeting.findUnique({
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
        throw new AppError('Opening meeting not found', 404);
      }

      if (meeting.archived) {
        throw new AppError('Meeting is already archived', 400);
      }

      const updatedMeeting = await prisma.openingMeeting.update({
        where: { id: meetingId },
        data: {
          archived: true,
          updatedAt: new Date()
        }
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          action: 'ARCHIVE_OPENING_MEETING',
          entityType: 'OPENING_MEETING',
          entityId: meetingId,
          userId: archivedBy,
          tenantId: meeting.audit.auditProgram.tenantId,
          details: `Archived opening meeting ${meetingId}`,
          metadata: {
            meetingId,
            archivedBy,
            archivedAt: new Date().toISOString()
          }
        }
      });

      return updatedMeeting;

    } catch (error) {
      logger.error('Error archiving opening meeting:', error);
      throw error;
    }
  }

  /**
   * Get default opening meeting agendas (for UI suggestions)
   * @param {string} tenantId - The tenant ID
   * @returns {Array} Default agenda suggestions
   */
  async getDefaultOpeningAgendas(tenantId) {
    try {
      // Get agenda template for suggestions
      const agendaTemplate = await agendaTemplateService.getAgendaTemplate('OPENING', tenantId);
      
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
          agendaText: "Introduction of audit team members",
          order: 1,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Overview of audit objectives and scope",
          order: 2,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Discussion of audit methodology and approach",
          order: 3,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Timeline and key milestones",
          order: 4,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Communication protocols and contact information",
          order: 5,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Questions and clarifications",
          order: 6,
          discussed: false,
          notes: null
        }
      ];
    } catch (error) {
      logger.error('Error getting default opening agendas:', error);
      // Return basic defaults on error
      return [
        {
          agendaText: "Introduction and audit overview",
          order: 1,
          discussed: false,
          notes: null
        },
        {
          agendaText: "Audit objectives and scope",
          order: 2,
          discussed: false,
          notes: null
        }
      ];
    }
  }
}

module.exports = new OpeningMeetingService(); 