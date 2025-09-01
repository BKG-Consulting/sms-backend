const planningMeetingRepository = require('../repositories/planningMeetingRepository');
const { logger } = require('../utils/logger.util');
const { AppError } = require('../../errors/app.error');
const socketService = require('./socketService');
const notificationService = require('./notificationService');

class PlanningMeetingService {
  // Create a new planning meeting
  async createPlanningMeeting(auditId, data) {
    try {
      logger.info(`Creating planning meeting for audit: ${auditId}`);

      const meetingData = {
        auditId,
        scheduledAt: data.scheduledAt || new Date(),
        createdById: data.createdById,
        notes: data.notes || '',
        venue: data.venue,
        status: data.status || 'UPCOMING'
      };

      const meeting = await planningMeetingRepository.create(meetingData);

      // Add attendances if provided
      if (data.attendances && Array.isArray(data.attendances)) {
        for (const attendance of data.attendances) {
          await planningMeetingRepository.addOrUpdateAttendance(meeting.id, {
            userId: attendance.userId,
            present: attendance.present,
            remarks: attendance.remarks
          });
        }
      }

      // Add agendas if provided
      if (data.agendas && Array.isArray(data.agendas)) {
        for (const agenda of data.agendas) {
          await planningMeetingRepository.addAgendaItem(meeting.id, {
            agendaText: agenda.agendaText,
            order: agenda.order,
            notes: agenda.notes
          });
        }
      }

      // Send notifications to team members
      await this.sendPlanningMeetingNotifications(meeting, 'created');

      logger.info(`Planning meeting created successfully: ${meeting.id}`);
      return { meeting };
    } catch (error) {
      logger.error('Error creating planning meeting:', error);
      throw error;
    }
  }

  // Get planning meeting by ID
  async getPlanningMeetingById(id) {
    try {
      const meeting = await planningMeetingRepository.findById(id);
      if (!meeting) {
        throw new AppError('Planning meeting not found', 404);
      }
      return { meeting };
    } catch (error) {
      logger.error('Error getting planning meeting by ID:', error);
      throw error;
    }
  }

  // Get planning meeting for a specific audit
  async getPlanningMeetingForAudit(auditId) {
    try {
      logger.info(`Getting planning meeting for audit: ${auditId}`);
      
      const meeting = await planningMeetingRepository.findByAuditId(auditId);
      
      if (meeting) {
        logger.info(`Found planning meeting: ${meeting.id} for audit: ${auditId}`);
      } else {
        logger.info(`No planning meeting found for audit: ${auditId}`);
      }
      
      return { meeting };
    } catch (error) {
      logger.error('Error getting planning meeting for audit:', error);
      throw error;
    }
  }

  // Get all planning meetings for an audit
  async getPlanningMeetingsByAudit(auditId) {
    try {
      const meetings = await planningMeetingRepository.findAllByAuditId(auditId);
      return { meetings };
    } catch (error) {
      logger.error('Error getting planning meetings by audit:', error);
      throw error;
    }
  }

  // Update planning meeting
  async updatePlanningMeeting(id, data) {
    try {
      const meeting = await planningMeetingRepository.update(id, data);
      
      // Send notifications if status changed
      if (data.status && data.status !== meeting.status) {
        await this.sendPlanningMeetingNotifications(meeting, 'updated');
      }
      
      return { meeting };
    } catch (error) {
      logger.error('Error updating planning meeting:', error);
      throw error;
    }
  }

  // Delete planning meeting
  async deletePlanningMeeting(id) {
    try {
      const meeting = await planningMeetingRepository.findById(id);
      if (!meeting) {
        throw new AppError('Planning meeting not found', 404);
      }

      await planningMeetingRepository.delete(id);
      
      // Send notifications
      await this.sendPlanningMeetingNotifications(meeting, 'deleted');
      
      return { success: true };
    } catch (error) {
      logger.error('Error deleting planning meeting:', error);
      throw error;
    }
  }

  // Archive planning meeting
  async archivePlanningMeeting(id) {
    try {
      const meeting = await planningMeetingRepository.archive(id);
      return { meeting };
    } catch (error) {
      logger.error('Error archiving planning meeting:', error);
      throw error;
    }
  }

  // Add or update attendance
  async addOrUpdateAttendance(meetingId, data) {
    try {
      const attendance = await planningMeetingRepository.addOrUpdateAttendance(meetingId, data);
      return { attendance };
    } catch (error) {
      logger.error('Error adding/updating attendance:', error);
      throw error;
    }
  }

  // Get attendance for a meeting
  async getAttendance(meetingId) {
    try {
      const attendances = await planningMeetingRepository.getAttendance(meetingId);
      return { attendances };
    } catch (error) {
      logger.error('Error getting attendance:', error);
      throw error;
    }
  }

  // Add agenda item
  async addAgendaItem(meetingId, data) {
    try {
      const agenda = await planningMeetingRepository.addAgendaItem(meetingId, data);
      return { agenda };
    } catch (error) {
      logger.error('Error adding agenda item:', error);
      throw error;
    }
  }

  // Update agenda item
  async updateAgendaItem(id, data) {
    try {
      const agenda = await planningMeetingRepository.updateAgendaItem(id, data);
      return { agenda };
    } catch (error) {
      logger.error('Error updating agenda item:', error);
      throw error;
    }
  }

  // Delete agenda item
  async deleteAgendaItem(id) {
    try {
      await planningMeetingRepository.deleteAgendaItem(id);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting agenda item:', error);
      throw error;
    }
  }

  // Get agenda items for a meeting
  async getAgendaItems(meetingId) {
    try {
      const agendas = await planningMeetingRepository.getAgendaItems(meetingId);
      return { agendas };
    } catch (error) {
      logger.error('Error getting agenda items:', error);
      throw error;
    }
  }

  // Batch update meeting with all related data
  async batchUpdateMeeting(meetingId, data) {
    try {
      const meeting = await planningMeetingRepository.batchUpdate(meetingId, data);
      
      // Send notifications if status changed
      if (data.status) {
        await this.sendPlanningMeetingNotifications(meeting, 'updated');
      }
      
      return { meeting };
    } catch (error) {
      logger.error('Error batch updating planning meeting:', error);
      throw error;
    }
  }

  // Start planning meeting
  async startPlanningMeeting(id) {
    try {
      const meeting = await planningMeetingRepository.update(id, { status: 'ACTIVE' });
      
      // Send notifications
      await this.sendPlanningMeetingNotifications(meeting, 'started');
      
      return { meeting };
    } catch (error) {
      logger.error('Error starting planning meeting:', error);
      throw error;
    }
  }

  // Complete planning meeting
  async completePlanningMeeting(id) {
    try {
      const meeting = await planningMeetingRepository.update(id, { status: 'COMPLETED' });
      
      // Send notifications
      await this.sendPlanningMeetingNotifications(meeting, 'completed');
      
      return { meeting };
    } catch (error) {
      logger.error('Error completing planning meeting:', error);
      throw error;
    }
  }

  // Cancel planning meeting
  async cancelPlanningMeeting(id) {
    try {
      const meeting = await planningMeetingRepository.update(id, { status: 'CANCELLED' });
      
      // Send notifications
      await this.sendPlanningMeetingNotifications(meeting, 'cancelled');
      
      return { meeting };
    } catch (error) {
      logger.error('Error cancelling planning meeting:', error);
      throw error;
    }
  }

  // Send notifications for planning meeting events
  async sendPlanningMeetingNotifications(meeting, event) {
    try {
      const audit = meeting.audit;
      const createdBy = meeting.createdBy;
      
      // Get team members for the audit
      const teamMembers = await this.getAuditTeamMembers(audit.id);
      
      const eventMessages = {
        created: `Planning meeting created for Audit #${audit.auditNo}`,
        updated: `Planning meeting updated for Audit #${audit.auditNo}`,
        started: `Planning meeting started for Audit #${audit.auditNo}`,
        completed: `Planning meeting completed for Audit #${audit.auditNo}`,
        cancelled: `Planning meeting cancelled for Audit #${audit.auditNo}`,
        deleted: `Planning meeting deleted for Audit #${audit.auditNo}`
      };

      const message = eventMessages[event] || `Planning meeting ${event} for Audit #${audit.auditNo}`;

      // Send notifications to team members
      for (const member of teamMembers) {
        if (member.userId !== createdBy.id) {
          await notificationService.createNotification({
            userId: member.userId,
            title: 'Planning Meeting Update',
            message,
            type: 'PLANNING_MEETING',
            metadata: {
              meetingId: meeting.id,
              auditId: audit.id,
              event,
              auditNo: audit.auditNo
            },
            tenantId: member.tenantId
          });
        }
      }

      // Send socket notifications
      socketService.emitToTenant(audit.auditProgram.tenantId, 'planning-meeting-update', {
        meetingId: meeting.id,
        auditId: audit.id,
        event,
        message
      });

    } catch (error) {
      logger.error('Error sending planning meeting notifications:', error);
      // Don't throw error as notifications are not critical
    }
  }

  // Get audit team members
  async getAuditTeamMembers(auditId) {
    try {
      const { prisma } = require('../../prisma/client');
      
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
                  email: true,
                  tenantId: true
                }
              }
            }
          }
        }
      });

      if (!audit) {
        return [];
      }

      return audit.teamMembers.map(member => ({
        userId: member.user.id,
        tenantId: member.user.tenantId,
        role: member.role,
        status: member.status
      }));
    } catch (error) {
      logger.error('Error getting audit team members:', error);
      return [];
    }
  }

  // Get planning meeting statistics
  async getPlanningMeetingStats(tenantId) {
    try {
      const { prisma } = require('../../prisma/client');
      
      const stats = await prisma.planningMeeting.groupBy({
        by: ['status'],
        where: {
          audit: {
            auditProgram: {
              tenantId
            }
          },
          archived: false
        },
        _count: {
          id: true
        }
      });

      const total = await prisma.planningMeeting.count({
        where: {
          audit: {
            auditProgram: {
              tenantId
            }
          },
          archived: false
        }
      });

      const statsMap = {
        total,
        upcoming: 0,
        active: 0,
        completed: 0,
        cancelled: 0
      };

      stats.forEach(stat => {
        statsMap[stat.status.toLowerCase()] = stat._count.id;
      });

      return statsMap;
    } catch (error) {
      logger.error('Error getting planning meeting stats:', error);
      throw error;
    }
  }
}

module.exports = new PlanningMeetingService(); 