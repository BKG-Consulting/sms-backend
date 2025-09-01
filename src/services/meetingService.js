/**
 * Meeting Service
 * Handles all meeting types: PLANNING, OPENING, CLOSING, MANAGEMENT_REVIEW
 * Uses the existing AuditPlanningMeeting model with different types
 */

const { DateTime } = require('luxon');
const { AppError } = require('../../errors/app.error');
const logger = require('../utils/logger');
const { prisma } = require('../../prisma/client');

// Core meeting service - handles common meeting operations
class MeetingService {
  // Get all meetings for a user (team leader or team member)
  async getUserMeetings(userId, tenantId, options = {}) {
    const {
      type,
      status,
      limit = 50,
      offset = 0,
      includeAudit = true,
      includeProgram = true
    } = options;

    try {
      // Get user's audit assignments
      const userAssignments = await prisma.auditTeamMember.findMany({
      where: { 
          userId,
          audit: {
            auditProgram: {
              tenantId
            }
          }
        },
        select: {
          auditId: true,
          role: true
        }
      });

      const auditIds = userAssignments.map(assignment => assignment.auditId);

      if (auditIds.length === 0) {
        return {
          meetings: [],
          total: 0,
          userRole: 'NO_ASSIGNMENTS'
        };
      }

      // Build where clause
      const whereClause = {
        auditId: { in: auditIds },
        archived: false
      };

      if (type) {
        whereClause.type = type;
      }

      if (status) {
        whereClause.status = status;
      }

      // Get meetings with pagination
      const [meetings, total] = await Promise.all([
        prisma.planningMeeting.findMany({
          where: whereClause,
          include: {
            audit: {
              select: {
                id: true,
                auditNo: true,
                type: true,
                auditDateFrom: true,
                auditDateTo: true,
                ...(includeProgram && {
                  auditProgram: {
                    select: {
                      id: true,
                      title: true,
                      status: true
                    }
                  }
                }),
                teamMembers: {
                  select: {
                    userId: true,
                    role: true,
                    status: true,
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
        attendances: {
              select: {
                id: true,
                userId: true,
                present: true,
                remarks: true,
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
              select: {
                id: true,
                agendaText: true,
                order: true,
                discussed: true
              },
              orderBy: {
                order: 'asc'
              }
            }
          },
          orderBy: {
            scheduledAt: 'desc'
          },
          take: limit,
          skip: offset
        }),
        prisma.planningMeeting.count({
          where: whereClause
        })
      ]);

      // Determine user role for each meeting
      const meetingsWithRoles = meetings.map(meeting => {
        const userAssignment = userAssignments.find(assignment => 
          assignment.auditId === meeting.auditId
        );
        
        return {
          ...meeting,
          userRole: userAssignment?.role || 'UNKNOWN',
          isTeamLeader: userAssignment?.role === 'TEAM_LEADER',
          isTeamMember: userAssignment?.role === 'TEAM_MEMBER'
        };
      });

      return {
        meetings: meetingsWithRoles,
        total,
        userRole: userAssignments.length > 0 ? 'ASSIGNED' : 'NO_ASSIGNMENTS'
      };
  } catch (error) {
      logger.error('Error getting user meetings:', error);
      throw new AppError('Failed to fetch meetings', 500);
    }
  }

  // Get meeting by ID with proper access control
  async getMeetingById(meetingId, userId, tenantId) {
    try {
      const meeting = await prisma.planningMeeting.findFirst({
      where: { 
          id: meetingId,
          audit: {
            auditProgram: {
              tenantId
            }
          }
      },
      include: {
        audit: {
            select: {
              id: true,
              auditNo: true,
              type: true,
              auditDateFrom: true,
              auditDateTo: true,
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
                  status: true,
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
        attendances: {
            select: {
              id: true,
              userId: true,
              present: true,
              remarks: true,
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
            select: {
              id: true,
              agendaText: true,
              order: true,
              discussed: true
            },
            orderBy: {
              order: 'asc'
          }
        }
      }
    });

    if (!meeting) {
        throw new AppError('Meeting not found or access denied', 404);
      }

      // Check if user is part of the audit team
      const userAssignment = meeting.audit.teamMembers.find(
        member => member.userId === userId
      );

      if (!userAssignment) {
        throw new AppError('Access denied: You are not part of this audit team', 403);
      }

      return {
        ...meeting,
        userRole: userAssignment.role,
        isTeamLeader: userAssignment.role === 'TEAM_LEADER',
        isTeamMember: userAssignment.role === 'TEAM_MEMBER'
      };
  } catch (error) {
      if (error.isOperational) throw error;
      logger.error('Error getting meeting by ID:', error);
      throw new AppError('Failed to fetch meeting', 500);
    }
  }

  // Check if user can create meetings for an audit
  async canCreateMeeting(auditId, userId, meetingType) {
    try {
      const audit = await prisma.audit.findUnique({
        where: { id: auditId },
      include: {
          auditProgram: {
            select: {
              id: true,
              title: true,
              status: true,
              tenantId: true
            }
          },
          teamMembers: {
            where: { userId },
            select: {
              role: true,
              status: true
            }
        }
      }
    });

      if (!audit) {
        return {
          canCreate: false,
          reason: 'Audit not found',
          code: 'AUDIT_NOT_FOUND'
        };
      }

      // Check if user is team leader
      const userAssignment = audit.teamMembers[0];
      if (!userAssignment || userAssignment.role !== 'TEAM_LEADER') {
        return {
          canCreate: false,
          reason: 'Only team leaders can create meetings',
          code: 'NOT_TEAM_LEADER'
        };
      }

      // Check if audit program is approved
      if (audit.auditProgram.status !== 'APPROVED') {
        return {
          canCreate: false,
          reason: 'Audit program must be approved to create meetings',
          code: 'PROGRAM_NOT_APPROVED'
        };
      }

      // Check if meeting already exists for this audit
      const existingMeeting = await prisma.planningMeeting.findFirst({
      where: {
          auditId,
          archived: false
        }
      });

      if (existingMeeting) {
        return {
          canCreate: false,
          reason: `A ${meetingType.toLowerCase()} meeting already exists for this audit`,
          code: 'MEETING_EXISTS',
          existingMeetingId: existingMeeting.id
        };
      }

      return {
        canCreate: true,
        reason: 'User can create meeting',
        code: 'ELIGIBLE',
        audit: {
          id: audit.id,
          auditNo: audit.auditNo,
          type: audit.type,
          programTitle: audit.auditProgram.title
        }
      };
  } catch (error) {
      logger.error('Error checking meeting creation eligibility:', error);
      throw new AppError('Failed to check meeting eligibility', 500);
    }
  }

  // Get available audits for meeting creation
  async getAvailableAuditsForMeetings(userId, tenantId, meetingType) {
    try {
      // Get all user's audit assignments (like the existing system does)
      const userAssignments = await prisma.auditTeamMember.findMany({
        where: {
          userId,
          audit: {
            auditProgram: {
              tenantId,
              status: 'APPROVED'
            }
          }
        },
        include: {
          audit: {
            select: {
              id: true,
              auditNo: true,
              type: true,
              auditDateFrom: true,
              auditDateTo: true,
              auditProgram: {
                select: {
                  id: true,
                  title: true,
                  status: true
                }
              }
            }
          }
        }
      });

      // Filter for team leader assignments and available audits
      const availableAudits = [];
      
      for (const assignment of userAssignments) {
        // Check if user is team leader for this audit
        if (assignment.role === 'TEAM_LEADER') {
          // Check if a meeting already exists for this audit
          const existingMeeting = await prisma.planningMeeting.findFirst({
            where: {
              auditId: assignment.audit.id,
              archived: false
            }
          });

          if (!existingMeeting) {
            availableAudits.push(assignment.audit);
          }
        }
      }

      return availableAudits;
    } catch (error) {
      logger.error('Error getting available audits for meetings:', error);
      throw new AppError('Failed to fetch available audits', 500);
    }
  }

  // Update meeting notes
  async updateMeetingNotes(meetingId, notes, userId) {
    try {
      const meeting = await prisma.planningMeeting.update({
        where: { id: meetingId },
        data: { 
          notes,
          updatedAt: new Date()
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
                  title: true
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      return meeting;
    } catch (error) {
      logger.error('Error updating meeting notes:', error);
      throw new AppError('Failed to update meeting notes', 500);
    }
  }

  // Update attendance
  async updateAttendance(meetingId, targetUserId, present, remarks, updatedBy) {
    try {
      // Check if attendance record already exists
      const existingAttendance = await prisma.auditPlanningAttendance.findFirst({
        where: {
          meetingId,
          userId: targetUserId
        }
      });

      if (existingAttendance) {
        // Update existing attendance record
        await prisma.auditPlanningAttendance.update({
          where: { id: existingAttendance.id },
          data: {
            present,
            remarks,
            updatedAt: new Date()
          }
        });
      } else {
        // Create new attendance record
        await prisma.auditPlanningAttendance.create({
          data: {
            meetingId,
            userId: targetUserId,
            present,
            remarks,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
      }

      // Return updated meeting with attendance data
      const meeting = await prisma.planningMeeting.findUnique({
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
                  title: true
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          attendances: {
            select: {
              id: true,
              userId: true,
              present: true,
              remarks: true,
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
      logger.error('Error updating attendance:', error);
      throw new AppError('Failed to update attendance', 500);
    }
  }

  // Create a new meeting of any type
  async createMeeting({
    auditId,
    type,
    createdById,
    scheduledAt,
    venue,
    notes,
    attendance,
    agendas,
    // Management Review specific parameters
    meetingDate,
    startTime,
    endTime
  }) {
    try {
      // Get audit details
      const audit = await prisma.audit.findUnique({
        where: { id: auditId },
        include: {
          auditProgram: {
            select: {
              id: true,
              title: true,
              status: true,
              tenantId: true
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
      });

      if (!audit) {
        throw new AppError('Audit not found', 404);
      }

      // Create the meeting
      const meeting = await prisma.planningMeeting.create({
        data: {
          auditId,
          type,
          scheduledAt: scheduledAt || new Date(),
          venue: venue || null,
          notes: notes || null,
          status: 'UPCOMING',
          createdById,
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
          }
        }
      });

      // Handle attendance records for different meeting types
      if (Array.isArray(attendance) && attendance.length > 0) {
        await Promise.all(attendance.map(att => 
          prisma.auditPlanningAttendance.create({
            data: {
              meetingId: meeting.id,
              userId: att.userId,
              present: att.present || false,
              remarks: att.remarks || null,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          })
        ));
      }

      // Handle agenda items for PLANNING meetings
      // Planning meetings can have initial agendas if provided, but they're not required
      if (type === 'PLANNING' && Array.isArray(agendas) && agendas.length > 0) {
        await Promise.all(agendas.map((agenda, index) => 
          prisma.auditPlanningAgenda.create({
            data: {
              meetingId: meeting.id,
              agendaText: agenda,
              order: index + 1,
              discussed: false
            }
          })
        ));
      }

      // Handle predefined agendas for other meeting types
      if (['OPENING', 'CLOSING', 'MANAGEMENT_REVIEW'].includes(type)) {
        let predefinedAgendas = [];
        
        if (type === 'OPENING') {
          const { openingMeetingAgendas } = require('../../constants/openingMeetingAgendas');
          predefinedAgendas = openingMeetingAgendas;
        } else if (type === 'CLOSING') {
          const { closingMeetingAgendas } = require('../../constants/closingMeetingAgendas');
          predefinedAgendas = closingMeetingAgendas;
        } else if (type === 'MANAGEMENT_REVIEW') {
          const { MANAGEMENT_REVIEW_AGENDAS } = require('../../constants/managementReviewAgendas');
          predefinedAgendas = MANAGEMENT_REVIEW_AGENDAS.map(agenda => agenda.label);
        }

        // Create agenda items
        await Promise.all(predefinedAgendas.map((agenda, index) => 
          prisma.auditPlanningAgenda.create({
            data: {
              meetingId: meeting.id,
              agendaText: agenda,
              order: index + 1,
              discussed: false
            }
          })
        ));
      }

      // --- Send invitations/messages for meetings with invitees ---
      let inviteeIds = [];

      // For Management Review meetings, automatically get HODs, PRINCIPAL, HOD AUDITOR, and MR
      if (type === "MANAGEMENT_REVIEW") {
        const managementRoles = ['HOD', 'PRINCIPAL', 'HOD AUDITOR', 'MR'];
        const managementUsers = await prisma.user.findMany({
          where: {
            tenantId: audit.auditProgram.tenantId,
            OR: [
              { defaultRole: { name: { in: managementRoles } } },
              { userRoles: { some: { role: { name: { in: managementRoles } } } } }
            ]
          },
          select: { id: true }
        });
        inviteeIds = managementUsers.map(user => user.id);
      }

      if (type === "MANAGEMENT_REVIEW" && Array.isArray(inviteeIds) && inviteeIds.length > 0) {
        let subject, body;
        
        if (type === 'MANAGEMENT_REVIEW') {
          // Use the parameters passed to the function
          const meetingVenue = venue;
          
          subject = `Management Review Invitation - ${audit.auditProgram.title}`;
          
          // Format the date properly
          const formattedDate = meetingDate ? new Date(meetingDate).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }) : new Date(meeting.scheduledAt).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
          
          body = `Management Review Invitation

Programme
${audit.auditProgram.title}
Audit Number
${audit.auditNo}
Management Review Meeting Date (S)
${formattedDate}
 

You are hereby notified and invited to the above mentioned forum to be held on the above mentioned date(S) from 
${startTime || 'TBA'} to ${endTime || 'TBA'} at ${meetingVenue || venue || 'TBA'}. 

The agenda of the meeting shall be:
1. Results of audit
2. Customer feedback
3. Process performance and product conformity
4. Status of preventive and corrective action
5. Follow up actions from previous management review meetings
6. Changes that could affect the quality management system
7. Recommendations for improvement
8. Any other business

Kindly prepare accordingly.

Yours Faithfully
Management Rep (Secretary to Management review meeting)`;
        }

        const msgMetadata = {
          meetingId: meeting.id,
          auditId,
          programTitle: audit.auditProgram.title,
          scheduledAt: meeting.scheduledAt,
          venue: venue || null,
          agendas: agendas || [],
          type: `${type}_MEETING_INVITATION`
        };

        await Promise.all(inviteeIds.map(userId =>
          prisma.message.create({
            data: {
              senderId: createdById,
              recipientId: userId,
              tenantId: audit.auditProgram.tenantId,
              subject,
              body,
              metadata: msgMetadata,
            }
          })
        ));

        // Emit real-time socket event
        try {
          const io = require('./socketService').getIO();
          for (const userId of inviteeIds) {
            io.to(`user:${userId}`).emit('messageCreated', {
              subject,
              body,
              recipientId: userId,
              meetingId: meeting.id,
            });
          }
        } catch (e) {
          logger.error('Socket emit error (Meeting invitation):', e);
        }
      }

      // Return the created meeting with full details
      const createdMeeting = await prisma.planningMeeting.findUnique({
        where: { id: meeting.id },
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
          attendances: {
            select: {
              id: true,
              userId: true,
              present: true,
              remarks: true,
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
            select: {
              id: true,
              agendaText: true,
              order: true,
              discussed: true
            },
            orderBy: {
              order: 'asc'
            }
          }
        }
      });

      return createdMeeting;
    } catch (error) {
      logger.error('Error creating meeting:', error);
      throw new AppError('Failed to create meeting', 500);
    }
  }

  // Get attendees for different meeting types based on permissions
  async getMeetingAttendees(meetingType, auditId, tenantId) {
    try {
      let attendees = [];

      if (meetingType === 'PLANNING') {
        // For planning meetings, get team members
        const audit = await prisma.audit.findUnique({
          where: { id: auditId },
          include: {
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
        });

        if (audit) {
          attendees = audit.teamMembers.map(member => ({
            userId: member.userId,
            role: member.role,
            user: member.user
          }));
        }
      } else if (meetingType === 'OPENING') {
        // For opening meetings, get users with Opening Meeting:attend permission
        const usersWithPermission = await prisma.user.findMany({
          where: {
            tenantId: tenantId,
            OR: [
              {
                defaultRole: {
                  permissions: {
                    some: {
                      permission: {
                        name: 'Opening Meeting:attend'
                      }
                    }
                  }
                }
              },
              {
                userRoles: {
                  some: {
                    role: {
                      permissions: {
                        some: {
                          permission: {
                            name: 'Opening Meeting:attend'
                          }
                        }
                      }
                    }
                  }
                }
              }
            ]
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            defaultRole: {
              select: {
                name: true
              }
            }
          }
        });

        attendees = usersWithPermission.map(user => ({
          userId: user.id,
          role: user.defaultRole?.name || 'USER',
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
          }
        }));
      } else if (meetingType === 'CLOSING') {
        // For closing meetings, get users with Closing Meeting:attend permission
        const usersWithPermission = await prisma.user.findMany({
          where: {
            tenantId: tenantId,
            OR: [
              {
                defaultRole: {
                  permissions: {
                    some: {
                      permission: {
                        name: 'Closing Meeting:attend'
                      }
                    }
                  }
                }
              },
              {
                userRoles: {
                  some: {
                    role: {
                      permissions: {
                        some: {
                          permission: {
                            name: 'Closing Meeting:attend'
                          }
                        }
                      }
                    }
                  }
                }
              }
            ]
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            defaultRole: {
              select: {
                name: true
              }
            }
          }
        });

        attendees = usersWithPermission.map(user => ({
          userId: user.id,
          role: user.defaultRole?.name || 'USER',
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
          }
        }));
      } else if (meetingType === 'MANAGEMENT_REVIEW') {
        // For management review meetings, get HODs, PRINCIPAL, HOD AUDITOR, and MR
        const managementRoles = ['HOD', 'PRINCIPAL', 'HOD AUDITOR', 'MR'];
        const managementUsers = await prisma.user.findMany({
          where: {
            tenantId: tenantId,
            OR: [
              { defaultRole: { name: { in: managementRoles } } },
              { userRoles: { some: { role: { name: { in: managementRoles } } } } }
            ]
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            defaultRole: {
              select: {
                name: true
              }
            }
          }
        });

        attendees = managementUsers.map(user => ({
          userId: user.id,
          role: user.defaultRole?.name || 'USER',
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email
          }
        }));
      }

      return attendees;
    } catch (error) {
      logger.error('Error getting meeting attendees:', error);
      throw new AppError('Failed to get meeting attendees', 500);
    }
  }

  // Send invitations for existing meetings
  async sendMeetingInvitations(meetingId, userId) {
    try {
      const meeting = await prisma.planningMeeting.findUnique({
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
                  status: true,
                  tenantId: true
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

      if (!meeting) {
        throw new AppError('Meeting not found', 404);
      }

  

      let inviteeIds = [];

      // For Management Review meetings, automatically get HODs, PRINCIPAL, HOD AUDITOR, and MR
      if (meeting.type === "MANAGEMENT_REVIEW") {
        const managementRoles = ['HOD', 'PRINCIPAL', 'HOD AUDITOR', 'MR'];
        const managementUsers = await prisma.user.findMany({
          where: {
            tenantId: meeting.audit.auditProgram.tenantId,
            OR: [
              { defaultRole: { name: { in: managementRoles } } },
              { userRoles: { some: { role: { name: { in: managementRoles } } } } }
            ]
          },
          select: { id: true }
        });
        inviteeIds = managementUsers.map(user => user.id);
      }

      if (meeting.type === "MANAGEMENT_REVIEW" && Array.isArray(inviteeIds) && inviteeIds.length > 0) {
        let subject, body;
        
        if (meeting.type === 'MANAGEMENT_REVIEW') {
          subject = `Management Review Invitation - ${meeting.audit.auditProgram.title}`;
          
          // Format the date properly
          const formattedDate = new Date(meeting.scheduledAt).toLocaleDateString('en-US', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          });
          
          body = `Management Review Invitation

Programme
${meeting.audit.auditProgram.title}
Audit Number
${meeting.audit.auditNo}
Management Review Meeting Date (S)
${formattedDate}
 

You are hereby notified and invited to the above mentioned forum to be held on the above mentioned date(S) from 
TBA to TBA at ${meeting.venue || 'TBA'}. 

The agenda of the meeting shall be:
1. Results of audit
2. Customer feedback
3. Process performance and product conformity
4. Status of preventive and corrective action
5. Follow up actions from previous management review meetings
6. Changes that could affect the quality management system
7. Recommendations for improvement
8. Any other business

Kindly prepare accordingly.

Yours Faithfully
Management Rep (Secretary to Management review meeting)`;
        }

        const msgMetadata = {
          meetingId: meeting.id,
          auditId: meeting.auditId,
          programTitle: meeting.audit.auditProgram.title,
          scheduledAt: meeting.scheduledAt,
          venue: meeting.venue || null,
          type: `${meeting.type}_MEETING_INVITATION`
        };

        await Promise.all(inviteeIds.map(recipientId =>
          prisma.message.create({
            data: {
              senderId: userId,
              recipientId,
              tenantId: meeting.audit.auditProgram.tenantId,
              subject,
              body,
              metadata: msgMetadata,
            }
          })
        ));

        // Emit real-time socket event
        try {
          const io = require('./socketService').getIO();
          for (const recipientId of inviteeIds) {
            io.to(`user:${recipientId}`).emit('messageCreated', {
              subject,
              body,
              recipientId,
              meetingId: meeting.id,
            });
          }
        } catch (e) {
          logger.error('Socket emit error (Meeting invitation):', e);
        }

        return {
          success: true,
          message: `Invitations sent to ${inviteeIds.length} recipients`,
          recipientsCount: inviteeIds.length
        };
      }

      return {
        success: false,
        message: 'No invitations to send for this meeting type'
      };
    } catch (error) {
      logger.error('Error sending meeting invitations:', error);
      throw new AppError('Failed to send meeting invitations', 500);
    }
  }

  // Delete a meeting (soft delete)
  async deleteMeeting(meetingId, userId) {
    try {
      const meeting = await prisma.planningMeeting.findUnique({
        where: { id: meetingId },
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
          }
        }
      });

      if (!meeting) {
        throw new AppError('Meeting not found', 404);
      }

      // Check if user is team leader for this meeting
      const userAssignment = await prisma.auditTeamMember.findFirst({
        where: {
          auditId: meeting.auditId,
          userId: userId,
          role: 'TEAM_LEADER'
        }
      });

      if (!userAssignment) {
        throw new AppError('Only team leaders can delete meetings', 403);
      }

      // Soft delete the meeting
      await prisma.planningMeeting.update({
        where: { id: meetingId },
        data: { 
          archived: true,
          updatedAt: new Date()
        }
      });

      return {
        success: true,
        message: 'Meeting deleted successfully'
      };
    } catch (error) {
      logger.error('Error deleting meeting:', error);
      throw new AppError('Failed to delete meeting', 500);
    }
  }

  // Update meeting status
  async updateMeetingStatus(meetingId, status, userId) {
    try {
      const meeting = await prisma.planningMeeting.update({
        where: { id: meetingId },
        data: { 
          status,
          updatedAt: new Date()
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
                  title: true
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      return meeting;
    } catch (error) {
      logger.error('Error updating meeting status:', error);
      throw new AppError('Failed to update meeting status', 500);
    }
  }
}

module.exports = new MeetingService(); 
