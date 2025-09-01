const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger.util');

class PlanningMeetingRepository {
  // Create a new planning meeting
  async create(data) {
    try {
      const meeting = await prisma.planningMeeting.create({
        data: {
          auditId: data.auditId,
          scheduledAt: data.scheduledAt || new Date(),
          createdById: data.createdById,
          notes: data.notes,
          venue: data.venue,
          status: data.status || 'UPCOMING'
        },
        include: {
          audit: {
            select: {
              id: true,
              auditNo: true,
              auditProgram: {
                select: {
                  id: true,
                  title: true
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
          }
        }
      });
      return meeting;
    } catch (error) {
      logger.error('Error creating planning meeting:', error);
      throw error;
    }
  }

  // Get planning meeting by ID
  async findById(id) {
    try {
      const meeting = await prisma.planningMeeting.findUnique({
        where: { id },
        include: {
          audit: {
            select: {
              id: true,
              auditNo: true,
              auditProgram: {
                select: {
                  id: true,
                  title: true
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
          agendas: {
            orderBy: { order: 'asc' }
          }
        }
      });
      return meeting;
    } catch (error) {
      logger.error('Error finding planning meeting by ID:', error);
      throw error;
    }
  }

  // Get planning meeting for a specific audit
  async findByAuditId(auditId) {
    try {
      const meeting = await prisma.planningMeeting.findFirst({
        where: { 
          auditId,
          archived: false
        },
        include: {
          audit: {
            select: {
              id: true,
              auditNo: true,
              auditProgram: {
                select: {
                  id: true,
                  title: true
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
          agendas: {
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return meeting;
    } catch (error) {
      logger.error('Error finding planning meeting by audit ID:', error);
      throw error;
    }
  }

  // Get all planning meetings for an audit
  async findAllByAuditId(auditId) {
    try {
      const meetings = await prisma.planningMeeting.findMany({
        where: { 
          auditId,
          archived: false
        },
        include: {
          audit: {
            select: {
              id: true,
              auditNo: true,
              auditProgram: {
                select: {
                  id: true,
                  title: true
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
          agendas: {
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return meetings;
    } catch (error) {
      logger.error('Error finding planning meetings by audit ID:', error);
      throw error;
    }
  }

  // Update planning meeting
  async update(id, data) {
    try {
      const meeting = await prisma.planningMeeting.update({
        where: { id },
        data: {
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.venue !== undefined && { venue: data.venue }),
          ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt }),
          updatedAt: new Date()
        },
        include: {
          audit: {
            select: {
              id: true,
              auditNo: true,
              auditProgram: {
                select: {
                  id: true,
                  title: true
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
          agendas: {
            orderBy: { order: 'asc' }
          }
        }
      });
      return meeting;
    } catch (error) {
      logger.error('Error updating planning meeting:', error);
      throw error;
    }
  }

  // Delete planning meeting
  async delete(id) {
    try {
      await prisma.planningMeeting.delete({
        where: { id }
      });
      return { success: true };
    } catch (error) {
      logger.error('Error deleting planning meeting:', error);
      throw error;
    }
  }

  // Archive planning meeting
  async archive(id) {
    try {
      const meeting = await prisma.planningMeeting.update({
        where: { id },
        data: { archived: true }
      });
      return meeting;
    } catch (error) {
      logger.error('Error archiving planning meeting:', error);
      throw error;
    }
  }

  // Add or update attendance
  async addOrUpdateAttendance(meetingId, data) {
    try {
      const attendance = await prisma.planningMeetingAttendance.upsert({
        where: {
          meetingId_userId: {
            meetingId,
            userId: data.userId
          }
        },
        update: {
          present: data.present,
          remarks: data.remarks,
          updatedAt: new Date()
        },
        create: {
          meetingId,
          userId: data.userId,
          present: data.present,
          remarks: data.remarks
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
      return attendance;
    } catch (error) {
      logger.error('Error adding/updating attendance:', error);
      throw error;
    }
  }

  // Get attendance for a meeting
  async getAttendance(meetingId) {
    try {
      const attendances = await prisma.planningMeetingAttendance.findMany({
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
      return attendances;
    } catch (error) {
      logger.error('Error getting attendance:', error);
      throw error;
    }
  }

  // Add agenda item
  async addAgendaItem(meetingId, data) {
    try {
      const agenda = await prisma.planningMeetingAgenda.create({
        data: {
          meetingId,
          agendaText: data.agendaText,
          order: data.order,
          notes: data.notes
        }
      });
      return agenda;
    } catch (error) {
      logger.error('Error adding agenda item:', error);
      throw error;
    }
  }

  // Update agenda item
  async updateAgendaItem(id, data) {
    try {
      const agenda = await prisma.planningMeetingAgenda.update({
        where: { id },
        data: {
          ...(data.agendaText !== undefined && { agendaText: data.agendaText }),
          ...(data.order !== undefined && { order: data.order }),
          ...(data.discussed !== undefined && { discussed: data.discussed }),
          ...(data.notes !== undefined && { notes: data.notes }),
          updatedAt: new Date()
        }
      });
      return agenda;
    } catch (error) {
      logger.error('Error updating agenda item:', error);
      throw error;
    }
  }

  // Delete agenda item
  async deleteAgendaItem(id) {
    try {
      await prisma.planningMeetingAgenda.delete({
        where: { id }
      });
      return { success: true };
    } catch (error) {
      logger.error('Error deleting agenda item:', error);
      throw error;
    }
  }

  // Get agenda items for a meeting
  async getAgendaItems(meetingId) {
    try {
      const agendas = await prisma.planningMeetingAgenda.findMany({
        where: { meetingId },
        orderBy: { order: 'asc' }
      });
      return agendas;
    } catch (error) {
      logger.error('Error getting agenda items:', error);
      throw error;
    }
  }

  // Batch update meeting with all related data
  async batchUpdate(meetingId, data) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Update meeting
        const meeting = await tx.planningMeeting.update({
          where: { id: meetingId },
          data: {
            ...(data.notes !== undefined && { notes: data.notes }),
            ...(data.status !== undefined && { status: data.status }),
            ...(data.venue !== undefined && { venue: data.venue }),
            updatedAt: new Date()
          }
        });

        // Update attendances if provided
        if (data.attendances && Array.isArray(data.attendances)) {
          for (const attendance of data.attendances) {
            await tx.planningMeetingAttendance.upsert({
              where: {
                meetingId_userId: {
                  meetingId,
                  userId: attendance.userId
                }
              },
              update: {
                present: attendance.present,
                remarks: attendance.remarks,
                updatedAt: new Date()
              },
              create: {
                meetingId,
                userId: attendance.userId,
                present: attendance.present,
                remarks: attendance.remarks
              }
            });
          }
        }

        // Update agendas if provided
        if (data.agendas && Array.isArray(data.agendas)) {
          // Delete existing agendas
          await tx.planningMeetingAgenda.deleteMany({
            where: { meetingId }
          });

          // Create new agendas
          for (const agenda of data.agendas) {
            await tx.planningMeetingAgenda.create({
              data: {
                meetingId,
                agendaText: agenda.agendaText,
                order: agenda.order,
                notes: agenda.notes,
                discussed: agenda.discussed || false
              }
            });
          }
        }

        return meeting;
      });

      return result;
    } catch (error) {
      logger.error('Error batch updating planning meeting:', error);
      throw error;
    }
  }
}

module.exports = new PlanningMeetingRepository(); 