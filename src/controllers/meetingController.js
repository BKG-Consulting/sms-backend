/**
 * Meeting Controller
 * Handles all meeting types: PLANNING, OPENING, CLOSING, MANAGEMENT_REVIEW
 */

const meetingService = require('../services/meetingService');
const { AppError } = require('../../errors/app.error');
const { logger } = require('../utils/logger');
const { prisma } = require('../../prisma/client');

// Get all meetings for the current user (unified approach)
const getUserMeetings = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    const { type, status, limit, offset } = req.query;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    // Build where clause for planning meetings (exclude opening/closing since they have dedicated tables)
    const planningWhereClause = {
      archived: false,
      audit: {
        auditProgram: {
          tenantId
        }
      }
    };

    if (status) {
      planningWhereClause.status = status;
    }

    // Only fetch planning meetings if no specific type is requested or if PLANNING is requested
    let planningMeetings = [];
    if (!type || type === 'PLANNING') {
      planningMeetings = await prisma.planningMeeting.findMany({
        where: planningWhereClause,
        include: {
          audit: {
            include: {
              auditProgram: {
                select: {
                  id: true,
                  title: true
                }
              },
              teamMembers: {
                where: { userId },
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true
                    }
                  }
                }
              }
            }
          },
          attendances: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
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
        },
        orderBy: { scheduledAt: 'desc' },
        take: limit ? parseInt(limit) : 50,
        skip: offset ? parseInt(offset) : 0
      });
    }

    // Get opening meetings (new model)
    const openingWhereClause = {
      archived: false,
      audit: {
        auditProgram: {
          tenantId
        }
      }
    };

    if (status) {
      openingWhereClause.status = status;
    }

    // Only fetch opening meetings if no specific type is requested or if OPENING is requested
    let openingMeetings = [];
    if (!type || type === 'OPENING') {
      openingMeetings = await prisma.openingMeeting.findMany({
        where: openingWhereClause,
        include: {
          audit: {
            include: {
              auditProgram: {
                select: {
                  id: true,
                  title: true
                }
              },
              teamMembers: {
                where: { userId },
                include: {
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true
                    }
                  }
                }
              }
            }
          },
          attendances: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
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
        },
        orderBy: { scheduledAt: 'desc' },
        take: limit ? parseInt(limit) : 50,
        skip: offset ? parseInt(offset) : 0
      });
    }

    // Get closing meetings (new model)
    const closingWhereClause = {
      archived: false,
      audit: {
        auditProgram: {
          tenantId
        }
      }
    };

    if (status) {
      closingWhereClause.status = status;
    }

    // Only fetch closing meetings if no specific type is requested or if CLOSING is requested
    let closingMeetings = [];
    if (!type || type === 'CLOSING') {
      closingMeetings = await prisma.closingMeeting.findMany({
        where: closingWhereClause,
      include: {
        audit: {
          include: {
            auditProgram: {
              select: {
                id: true,
                title: true
              }
            },
            teamMembers: {
              where: { userId },
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
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
      },
      orderBy: { scheduledAt: 'desc' },
      take: limit ? parseInt(limit) : 50,
      skip: offset ? parseInt(offset) : 0
      });
    }

    // Get Management Review meetings
    const managementReviewWhereClause = {
      archived: false,
      audit: {
        auditProgram: {
          tenantId
        }
      }
    };

    if (status) {
      managementReviewWhereClause.status = status;
    }

    // Only fetch Management Review meetings if no specific type is requested or if MANAGEMENT_REVIEW is requested
    let managementReviewMeetings = [];
    if (!type || type === 'MANAGEMENT_REVIEW') {
      managementReviewMeetings = await prisma.managementReviewMeeting.findMany({
        where: managementReviewWhereClause,
      include: {
        audit: {
          include: {
            auditProgram: {
              select: {
                id: true,
                title: true
              }
            },
            teamMembers: {
              where: { userId },
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
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
      },
      orderBy: { scheduledAt: 'desc' },
      take: limit ? parseInt(limit) : 50,
      skip: offset ? parseInt(offset) : 0
      });
    }

    // Transform and combine meetings
    const transformMeeting = (meeting, type) => {
      // Check if user is team leader for this audit
      const isTeamLeader = meeting.audit.teamMembers?.some(tm => 
        tm.userId === userId && tm.role === 'TEAM_LEADER'
      ) || false;

      // Check if user is team member for this audit
      const isTeamMember = meeting.audit.teamMembers?.some(tm => 
        tm.userId === userId
      ) || false;

      return {
        id: meeting.id,
        type,
        status: meeting.status,
        scheduledAt: meeting.scheduledAt,
        notes: meeting.notes,
        venue: meeting.venue,
        audit: {
          id: meeting.audit.id,
          auditNo: meeting.audit.auditNo,
          type: meeting.audit.type,
          auditProgram: meeting.audit.auditProgram
        },
        createdBy: meeting.createdBy,
        attendances: meeting.attendances || [],
        userRole: isTeamLeader ? 'TEAM_LEADER' : isTeamMember ? 'TEAM_MEMBER' : 'VIEWER',
        isTeamLeader,
        isTeamMember
      };
    };

    const transformedPlanningMeetings = planningMeetings.map(m => transformMeeting(m, 'PLANNING'));
    const transformedOpeningMeetings = openingMeetings.map(m => transformMeeting(m, 'OPENING'));
    const transformedClosingMeetings = closingMeetings.map(m => transformMeeting(m, 'CLOSING'));
    const transformedManagementReviewMeetings = managementReviewMeetings.map(m => transformMeeting(m, 'MANAGEMENT_REVIEW'));

    // Combine all meetings and sort by scheduledAt
    const allMeetings = [
      ...transformedPlanningMeetings,
      ...transformedOpeningMeetings,
      ...transformedClosingMeetings,
      ...transformedManagementReviewMeetings
    ].sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt));

    // Calculate statistics
    const stats = {
      total: allMeetings.length,
      byType: {
        PLANNING: transformedPlanningMeetings.length,
        OPENING: transformedOpeningMeetings.length,
        CLOSING: transformedClosingMeetings.length,
        MANAGEMENT_REVIEW: transformedManagementReviewMeetings.length
      },
      byStatus: {
        UPCOMING: allMeetings.filter(m => m.status === 'UPCOMING').length,
        ACTIVE: allMeetings.filter(m => m.status === 'ACTIVE').length,
        COMPLETED: allMeetings.filter(m => m.status === 'COMPLETED').length
      },
      upcoming: allMeetings.filter(m => 
        m.status === 'UPCOMING' && new Date(m.scheduledAt) > new Date()
      ).length,
      today: allMeetings.filter(m => {
        const today = new Date();
        const meetingDate = new Date(m.scheduledAt);
        return meetingDate.toDateString() === today.toDateString();
      }).length
    };
    
    res.json({
      success: true,
      data: {
        meetings: allMeetings,
        stats
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get meeting by ID
const getMeetingById = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const meeting = await meetingService.getMeetingById(meetingId, userId, tenantId);
    
    res.json({
      success: true,
      data: meeting
    });
  } catch (error) {
    next(error);
  }
};

// Get available audits for creating a specific meeting type
const getAvailableAuditsForMeeting = async (req, res, next) => {
  try {
    const { meetingType } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    // Validate meeting type
    const validTypes = ['PLANNING', 'OPENING', 'CLOSING', 'MANAGEMENT_REVIEW'];
    if (!validTypes.includes(meetingType)) {
      return res.status(400).json({ 
        message: 'Invalid meeting type. Must be one of: PLANNING, OPENING, CLOSING, MANAGEMENT_REVIEW' 
      });
    }

    const audits = await meetingService.getAvailableAuditsForMeetings(userId, tenantId, meetingType);
    
    res.json({
      success: true,
      data: audits
    });
  } catch (error) {
    next(error);
  }
};

// Check if user can create a meeting for an audit
const checkMeetingCreationEligibility = async (req, res, next) => {
  try {
    const { auditId, meetingType } = req.params;
    const userId = req.user.userId;

    // Validate meeting type
    const validTypes = ['PLANNING', 'OPENING', 'CLOSING', 'MANAGEMENT_REVIEW'];
    if (!validTypes.includes(meetingType)) {
      return res.status(400).json({ 
        message: 'Invalid meeting type. Must be one of: PLANNING, OPENING, CLOSING, MANAGEMENT_REVIEW' 
      });
    }

    const eligibility = await meetingService.canCreateMeeting(auditId, userId, meetingType);
    
    res.json({
      success: true,
      data: eligibility
    });
  } catch (error) {
    next(error);
  }
};

// Create a new meeting (delegates to audit service for now)
const createMeeting = async (req, res, next) => {
  try {
    const { auditId, meetingType } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    const meetingData = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    // Validate meeting type
    const validTypes = ['PLANNING', 'OPENING', 'CLOSING', 'MANAGEMENT_REVIEW'];
    if (!validTypes.includes(meetingType)) {
      return res.status(400).json({ 
        message: 'Invalid meeting type. Must be one of: PLANNING, OPENING, CLOSING, MANAGEMENT_REVIEW' 
      });
    }

    // Check eligibility first
    const eligibility = await meetingService.canCreateMeeting(auditId, userId, meetingType);
    if (!eligibility.canCreate) {
      return res.status(400).json({
        success: false,
        message: eligibility.reason,
        code: eligibility.code
      });
    }

    // Create meeting using meeting service
    const result = await meetingService.createMeeting({
      auditId,
      type: meetingType,
      createdById: userId,
      ...meetingData
    });

    logger.info('Meeting created successfully', {
      meetingId: result.id,
      auditId,
      meetingType,
      createdBy: userId
    });

    res.status(201).json({
      success: true,
      message: `${meetingType} meeting created successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Update meeting notes
const updateMeetingNotes = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    const { notes } = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    // Get the meeting to check if user is team leader
    const meeting = await meetingService.getMeetingById(meetingId, userId, tenantId);
    
    if (!meeting.isTeamLeader) {
      return res.status(403).json({
        success: false,
        message: 'Only team leaders can update meeting notes'
      });
    }

    // Update meeting notes
    const result = await meetingService.updateMeetingNotes(meetingId, notes, userId);

    logger.info('Meeting notes updated successfully', {
      meetingId,
      updatedBy: userId
    });

    res.json({
      success: true,
      message: 'Meeting notes updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Update attendance
const updateAttendance = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    const { userId: targetUserId, present, remarks } = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    // Get the meeting to check permissions
    const meeting = await meetingService.getMeetingById(meetingId, userId, tenantId);
    
    // Allow team leaders to update anyone's attendance, or users to update their own
    const canUpdate = meeting.isTeamLeader || userId === targetUserId;
    
    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own attendance or must be a team leader'
      });
    }

    // Update attendance
    const result = await meetingService.updateAttendance(meetingId, targetUserId, present, remarks, userId);

    logger.info('Attendance updated successfully', {
      meetingId,
      targetUserId,
      present,
      updatedBy: userId
    });

    res.json({
      success: true,
      message: 'Attendance updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Send invitations for existing meetings
const sendMeetingInvitations = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const result = await meetingService.sendMeetingInvitations(meetingId, userId);

    logger.info('Meeting invitations sent successfully', {
      meetingId,
      sentBy: userId,
      recipientsCount: result.recipientsCount
    });

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Delete a meeting
const deleteMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const result = await meetingService.deleteMeeting(meetingId, userId);

    logger.info('Meeting deleted successfully', {
      meetingId,
      deletedBy: userId
    });

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    next(error);
  }
};

// Complete a meeting
const completeMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    const { status } = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    // Get the meeting to check if user is team leader
    const meeting = await meetingService.getMeetingById(meetingId, userId, tenantId);
    
    if (!meeting.isTeamLeader) {
      return res.status(403).json({
        success: false,
        message: 'Only team leaders can complete meetings'
      });
    }

    // Update meeting status to completed
    const result = await meetingService.updateMeetingStatus(meetingId, 'COMPLETED', userId);

    logger.info('Meeting completed successfully', {
      meetingId,
      completedBy: userId,
      status: 'COMPLETED'
    });

    res.json({
      success: true,
      message: 'Meeting completed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Get meeting statistics for dashboard
const getMeetingStats = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    // Get all meetings for the user
    const { meetings } = await meetingService.getUserMeetings(userId, tenantId, { limit: 1000 });

    // Calculate statistics
    const stats = {
      total: meetings.length,
      byType: {
        PLANNING: 0,
        OPENING: 0,
        CLOSING: 0,
        MANAGEMENT_REVIEW: 0
      },
      byStatus: {
        UPCOMING: 0,
        ACTIVE: 0,
        COMPLETED: 0
      },
      upcoming: 0,
      today: 0,
      thisWeek: 0
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    meetings.forEach(meeting => {
      // Count by type
      stats.byType[meeting.type]++;
      
      // Count by status
      stats.byStatus[meeting.status]++;

      // Count upcoming meetings
      if (meeting.scheduledAt > now) {
        stats.upcoming++;
        
        const meetingDate = new Date(meeting.scheduledAt);
        const meetingDay = new Date(meetingDate.getFullYear(), meetingDate.getMonth(), meetingDate.getDate());
        
        if (meetingDay.getTime() === today.getTime()) {
          stats.today++;
        }
        
        if (meetingDate >= weekStart && meetingDate <= new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)) {
          stats.thisWeek++;
        }
      }
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserMeetings,
  getMeetingById,
  getAvailableAuditsForMeeting,
  checkMeetingCreationEligibility,
  createMeeting,
  updateMeetingNotes,
  updateAttendance,
  sendMeetingInvitations,
  deleteMeeting,
  completeMeeting,
  getMeetingStats
}; 