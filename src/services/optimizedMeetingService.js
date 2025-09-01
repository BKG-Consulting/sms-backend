/**
 * Optimized Meeting Service
 * Handles opening and closing meetings with single-transaction operations
 * to reduce database connections and improve performance
 */

const { prisma } = require('../../prisma/client');
const { DateTime } = require('luxon');
const { AppError } = require('../../errors/app.error');
const { logger } = require('../utils/logger');
const agendaTemplateService = require('./agendaTemplateService');



class OptimizedMeetingService {
  /**
   * Create a meeting with all related data in a single transaction
   * @param {string} meetingType - 'OPENING' or 'CLOSING'
   * @param {Object} params - Meeting creation parameters
   * @returns {Object} Created meeting with full details
   */
  async createMeetingWithData(meetingType, {
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

      if (!['OPENING', 'CLOSING'].includes(meetingType)) {
        throw new AppError('Invalid meeting type. Must be OPENING or CLOSING', 400);
      }

      // Check if meeting already exists for this audit
      const existing = await prisma[`${meetingType.toLowerCase()}Meeting`].findFirst({
        where: { 
          auditId, 
          archived: false 
        }
      });

      if (existing) {
        throw new AppError(`${meetingType} meeting already exists for this audit`, 409);
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

      // Get agenda template
      const agendaTemplate = await agendaTemplateService.getAgendaTemplate(meetingType, audit.auditProgram.tenantId);
      
      if (!agendaTemplate) {
        throw new AppError(`${meetingType} meeting agenda template not found. Please contact administrator.`, 404);
      }

      // Create meeting with all related data in a single transaction
      const result = await prisma.$transaction(async (tx) => {
        const meetingTable = `${meetingType.toLowerCase()}Meeting`;
        const agendaTable = `${meetingType.toLowerCase()}MeetingAgenda`;
        const attendanceTable = `${meetingType.toLowerCase()}MeetingAttendance`;

        // 1. Create the meeting
        const meeting = await tx[meetingTable].create({
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
          await tx[agendaTable].createMany({
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

          await tx[attendanceTable].createMany({
            data: attendanceData
          });
        }

        // 4. Create audit log entry
        await tx.auditLog.create({
          data: {
            action: `CREATE_${meetingType}_MEETING`,
            entityType: `${meetingType}_MEETING`,
            entityId: meeting.id,
            userId: createdById,
            tenantId: audit.auditProgram.tenantId,
            details: `Created ${meetingType.toLowerCase()} meeting for audit ${audit.auditNo} (${audit.auditProgram.title})`,
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
      const completeMeeting = await this.getMeetingById(meetingType, result.id);

      logger.info(`${meetingType} meeting created successfully with all data`, {
        meetingId: result.id,
        auditId,
        createdById,
        agendaCount: agendas.length || agendaTemplate.items.length,
        attendanceCount: attendance.length
      });

      return completeMeeting;

    } catch (error) {
      logger.error(`Error creating ${meetingType} meeting with data:`, error);
      throw error;
    }
  }

  /**
   * Batch update meeting with all related data
   * @param {string} meetingType - 'OPENING' or 'CLOSING'
   * @param {string} meetingId - The meeting ID
   * @param {Object} data - Update data
   * @param {string} updatedBy - User updating the meeting
   * @returns {Object} Updated meeting with full details
   */
  async batchUpdateMeeting(meetingType, meetingId, data, updatedBy) {
    try {
      const meetingTable = `${meetingType.toLowerCase()}Meeting`;
      const agendaTable = `${meetingType.toLowerCase()}MeetingAgenda`;
      const attendanceTable = `${meetingType.toLowerCase()}MeetingAttendance`;

      const meeting = await prisma[meetingTable].findUnique({
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
        throw new AppError(`${meetingType} meeting not found`, 404);
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. Update meeting basic info
        const updatedMeeting = await tx[meetingTable].update({
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
          await tx[attendanceTable].deleteMany({
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

            await tx[attendanceTable].createMany({
              data: attendanceData
            });
          }
        }

        // 3. Update agenda items if provided
        if (data.agendas && Array.isArray(data.agendas)) {
          // Delete existing agenda items
          await tx[agendaTable].deleteMany({
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

            await tx[agendaTable].createMany({
              data: agendaData
            });
          }
        }

        // 4. Create audit log
        await tx.auditLog.create({
          data: {
            action: `BATCH_UPDATE_${meetingType}_MEETING`,
            entityType: `${meetingType}_MEETING`,
            entityId: meetingId,
            userId: updatedBy,
            tenantId: meeting.audit.auditProgram.tenantId,
            details: `Batch updated ${meetingType.toLowerCase()} meeting ${meetingId}`,
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
      const completeMeeting = await this.getMeetingById(meetingType, meetingId);

      logger.info(`${meetingType} meeting batch updated successfully`, {
        meetingId,
        updatedBy,
        attendanceCount: data.attendance?.length || 0,
        agendaCount: data.agendas?.length || 0
      });

      return completeMeeting;

    } catch (error) {
      logger.error(`Error batch updating ${meetingType} meeting:`, error);
      throw error;
    }
  }

  /**
   * Get meeting by ID with full details
   * @param {string} meetingType - 'OPENING' or 'CLOSING'
   * @param {string} meetingId - The meeting ID
   * @returns {Object} Meeting with full details
   */
  async getMeetingById(meetingType, meetingId) {
    try {
      const meetingTable = `${meetingType.toLowerCase()}Meeting`;

      const meeting = await prisma[meetingTable].findUnique({
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
        throw new AppError(`${meetingType} meeting not found`, 404);
      }

      return meeting;
    } catch (error) {
      logger.error(`Error getting ${meetingType} meeting by ID:`, error);
      throw error;
    }
  }

  /**
   * Get meeting by audit ID
   * @param {string} meetingType - 'OPENING' or 'CLOSING'
   * @param {string} auditId - The audit ID
   * @returns {Object|null} Meeting or null if not found
   */
  async getMeetingByAudit(meetingType, auditId) {
    try {
      const meetingTable = `${meetingType.toLowerCase()}Meeting`;

      const meeting = await prisma[meetingTable].findFirst({
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
      logger.error(`Error getting ${meetingType} meeting by audit:`, error);
      throw error;
    }
  }

  /**
   * Get meeting attendees based on role permissions
   * @param {string} meetingType - 'OPENING' or 'CLOSING'
   * @param {string} auditId - The audit ID
   * @param {string} tenantId - The tenant ID
   * @returns {Array} Array of attendees with user details
   */
  async getMeetingAttendees(meetingType, auditId, tenantId) {
    try {
      // Get users with meeting attendance permission
      const usersWithPermission = await prisma.user.findMany({
        where: {
          tenantId: tenantId,
          userRoles: {
            some: {
              role: {
                rolePermissions: {
                  some: {
                    permission: {
                      module: `${meetingType} Meeting`,
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
      logger.error(`Error getting ${meetingType} meeting attendees:`, error);
      throw new AppError(`Failed to get ${meetingType} meeting attendees`, 500);
    }
  }
}

module.exports = new OptimizedMeetingService(); 