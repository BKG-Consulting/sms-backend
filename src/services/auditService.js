// src/services/auditService.js
const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger.util');
const { AppError } = require('../../errors/app.error');
const socketService = require('./socketService');
const messageService = require('./messageService');
const auditRepository = require('../repositories/auditRepository');
const { DateTime } = require('luxon');
const { createNotification } = require('../repositories/notification.repository');
const notificationService = require('./notificationService');

// Helper function to strip HTML tags
const stripHtmlTags = (htmlString) => {
  if (!htmlString) return '';
  return htmlString.replace(/<[^>]*>/g, '').trim();
};

// Helper function to process rich text arrays
const processRichTextArray = (textArray) => {
  if (!Array.isArray(textArray)) return [];
  return textArray.map(item => stripHtmlTags(item));
};

// the audit creation functions
const createAudit = async ({ 
  auditProgramId, 
  auditNo, 
  type, 
  objectives = [],
  scope = [],
  criteria = [],
  methods = [],
  auditDateFrom,
  auditDateTo,
  teamLeaderAppointmentDate,
  teamMemberAppointmentDate,
  followUpDateFrom,
  followUpDateTo,
  managementReviewDateFrom,
  managementReviewDateTo,
  tenantId, 
  createdBy 
}) => {

  // validation step 
  if (!auditProgramId || !auditNo || !type || !tenantId || !createdBy) {
    throw new AppError('Missing required fields: auditProgramId, auditNo, type, tenantId, createdBy', 400);
  }
// inside the try and catch block
  try {

    // Process rich text content - preserve HTML for objectives, criteria, methods
    const processedObjectives = Array.isArray(objectives) ? objectives : [objectives || ''];
    const processedScope = Array.isArray(scope) ? scope : []; // Scope is usually just strings
    const processedCriteria = Array.isArray(criteria) ? criteria : [criteria || ''];
    const processedMethods = Array.isArray(methods) ? methods : [methods || ''];

    // initialize the
    const result = await prisma.$transaction(async (tx) => {
      const auditProgram = await tx.auditProgram.findFirst({
        where: { id: auditProgramId, tenantId }
      });
      if (!auditProgram) {
        throw new AppError('Audit program not found or access denied', 404);
      }

      const existingAudit = await tx.audit.findFirst({
        where: { auditProgramId, auditNo }
      });
      if (existingAudit) {
        throw new AppError(`Audit number ${auditNo} already exists for this program`, 400);
      }

      const audit = await tx.audit.create({
        data: {
          auditProgramId,
          auditNo,
          type,
          objectives: processedObjectives,
          scope: processedScope,
          criteria: processedCriteria,
          methods: processedMethods,
          auditDateFrom: auditDateFrom ? new Date(auditDateFrom) : null,
          auditDateTo: auditDateTo ? new Date(auditDateTo) : null,
          teamLeaderAppointmentDate: teamLeaderAppointmentDate ? new Date(teamLeaderAppointmentDate) : null,
          teamMemberAppointmentDate: teamMemberAppointmentDate ? new Date(teamMemberAppointmentDate) : null,
          followUpDateFrom: followUpDateFrom ? new Date(followUpDateFrom) : null,
          followUpDateTo: followUpDateTo ? new Date(followUpDateTo) : null,
          managementReviewDateFrom: managementReviewDateFrom ? new Date(managementReviewDateFrom) : null,
          managementReviewDateTo: managementReviewDateTo ? new Date(managementReviewDateTo) : null,
          status: 'OPEN'
        },
        include: {
          auditProgram: { select: { id: true, title: true, status: true } },
          teamMembers: {
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'AUDIT',
          entityId: audit.id,
          userId: createdBy,
          tenantId,
          details: `Created audit ${auditNo} for program: ${auditProgram.title}`,
          metadata: { auditNo, type, objectives: processedObjectives, scope: processedScope, criteria: processedCriteria, methods: processedMethods, auditDateFrom, auditDateTo, followUpDateFrom, followUpDateTo }
        }
      });

      logger.info('Audit created successfully', { auditId: audit.id, auditNo, type, auditProgramId, tenantId, createdBy });
      return audit;
    });

    return result;
  } catch (error) {
    logger.error('Error creating audit:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};
const getPlanningMeetingFullDetails = async (meetingId) => {
  try {
    return await auditRepository.findPlanningMeetingById(meetingId, {
      include: {
        audit: {
          include: {
            auditProgram: { select: { id: true, title: true, status: true } },
            teamMembers: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } }
                // role: true // <-- REMOVE THIS LINE, role is a scalar field
              }
            }
          }
        },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        attendances: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        agendas: { orderBy: { order: 'asc' } }
      }
    });
  } catch (error) {
    logger.error('Error fetching full planning meeting details:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};
const getAuditsByProgram = async (auditProgramId, tenantId) => {
  try {
    const audits = await prisma.audit.findMany({
      where: {
        auditProgramId,
        auditProgram: { tenantId }
      },
      include: {
        teamMembers: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          }
        }
      },
      orderBy: { auditNo: 'asc' }
    });
    return audits;
  } catch (error) {
    logger.error('Error fetching audits:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getAuditById = async (auditId, tenantId) => {
  try {
    const audit = await prisma.audit.findFirst({
      where: {
        id: auditId,
        auditProgram: { tenantId }
      },
      include: {
        auditProgram: { select: { id: true, title: true, status: true } },
        teamMembers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        }
      }
    });

    if (!audit) {
      throw new AppError('Audit not found', 404);
    }
    
    // Log the audit data for debugging
    console.log('🔍 [AUDIT_SERVICE] getAuditById returned audit:', {
      id: audit.id,
      type: audit.type,
      managementReviewDateFrom: audit.managementReviewDateFrom,
      managementReviewDateTo: audit.managementReviewDateTo,
      hasManagementReviewDates: !!(audit.managementReviewDateFrom && audit.managementReviewDateTo)
    });
    
    return audit;
  } catch (error) {
    logger.error('Error fetching audit:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const updateAudit = async ({ auditId, updates, tenantId, updatedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingAudit = await tx.audit.findFirst({
        where: { id: auditId, auditProgram: { tenantId } },
        include: { auditProgram: { select: { title: true } } }
      });

      if (!existingAudit) {
        throw new AppError('Audit not found or access denied', 404);
      }

      const updatedAudit = await tx.audit.update({
        where: { id: auditId },
        data: updates,
        include: {
          auditProgram: { select: { id: true, title: true, status: true } },
          teamMembers: {
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
          }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'AUDIT',
          entityId: auditId,
          userId: updatedBy,
          tenantId,
          details: `Updated audit ${existingAudit.auditNo} for program: ${existingAudit.auditProgram.title}`,
          metadata: { updates }
        }
      });

      logger.info('Audit updated successfully', { auditId, tenantId, updatedBy, updates });
      return updatedAudit;
    });

    return result;
  } catch (error) {
    logger.error('Error updating audit:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const addOrUpdateTeamMember = async ({ auditId, userId, role, tenantId, updatedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const audit = await tx.audit.findFirst({
        where: { id: auditId, auditProgram: { tenantId } }
      });

      if (!audit) {
        throw new AppError('Audit not found or access denied', 404);
      }

      const user = await tx.user.findFirst({
        where: { id: userId, tenantId }
      });

      if (!user) {
        throw new AppError('User not found or does not belong to tenant', 404);
      }

      if (role === 'TEAM_LEADER') {
        const currentLeader = await tx.auditTeamMember.findFirst({
          where: { auditId, role: 'TEAM_LEADER' }
        });
        if (currentLeader && currentLeader.userId !== userId) {
          throw new AppError('An audit can only have one team leader.', 400);
        }
      }

      const teamMember = await tx.auditTeamMember.upsert({
        where: { auditId_userId: { auditId, userId } },
        update: { role, appointedAt: new Date() },
        create: { auditId, userId, role, appointedAt: new Date() },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'ADD_OR_UPDATE_TEAM_MEMBER',
          entityType: 'AUDIT',
          entityId: auditId,
          userId: updatedBy,
          tenantId,
          details: `Added/Updated team member ${user.firstName} ${user.lastName} as ${role} for audit ${audit.auditNo}`,
          metadata: { userId, role }
        }
      });

      return teamMember;
    });

    return result;
  } catch (error) {
    logger.error('Error adding or updating team member:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const removeTeamMember = async ({ auditId, userId, tenantId, removedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const audit = await tx.audit.findFirst({
        where: { id: auditId, auditProgram: { tenantId } },
        include: { teamMembers: { include: { user: true } }, auditProgram: { select: { title: true } } }
      });

      if (!audit) {
        throw new AppError('Audit not found or access denied', 404);
      }

      const teamMember = await tx.auditTeamMember.findUnique({
        where: { auditId_userId: { auditId, userId } },
        include: { user: true }
      });

      if (!teamMember) {
        throw new AppError('User is not a team member of this audit.', 400);
      }

      // Remove the team member (can be leader or member)
      await tx.auditTeamMember.delete({ where: { id: teamMember.id } });

      // Notification message
      const isLeader = teamMember.role === 'TEAM_LEADER';
      const notifTitle = isLeader ? 'Removed as Audit Team Leader' : 'Removed as Audit Team Member';
      const notifMsg = isLeader
        ? `You have been removed as the team leader for audit ${audit.auditNo} (${audit.auditProgram.title}).`
        : `You have been removed as a team member for audit ${audit.auditNo} (${audit.auditProgram.title}).`;

      // Create notification in DB
      const notification = await tx.notification.create({
        data: {
          type: isLeader ? 'AUDIT_TEAM_LEADER_REMOVED' : 'AUDIT_TEAM_MEMBER_REMOVED',
          title: notifTitle,
          message: notifMsg,
          tenantId,
          targetUserId: userId,
          link: `/audits/${auditId}`,
          metadata: { auditId, auditNo: audit.auditNo, programTitle: audit.auditProgram.title, removedBy },
        }
      });

      // Emit real-time notification
      try {
        const io = socketService.getIO();
        io.to(`user:${userId}`).emit('notificationCreated', { ...notification, userId });
      } catch (e) {
        logger.error('Socket emit error (removeTeamMember):', e);
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          action: isLeader ? 'REMOVE_TEAM_LEADER' : 'REMOVE_TEAM_MEMBER',
          entityType: 'AUDIT',
          entityId: auditId,
          userId: removedBy,
          tenantId,
          details: `Removed ${isLeader ? 'team leader' : 'team member'} (${teamMember.user.email}) from audit ${audit.auditNo}`,
          metadata: { userId, role: teamMember.role },
        }
      });

      return { success: true, removedUser: { id: userId, role: teamMember.role } };
    });
    return result;
  } catch (error) {
    logger.error('Error removing team member:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const deleteAudit = async ({ auditId, tenantId, deletedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const audit = await tx.audit.findFirst({
        where: { id: auditId, auditProgram: { tenantId } },
        include: { auditProgram: { select: { id: true, title: true, status: true } } }
      });

      if (!audit) {
        throw new AppError('Audit not found or access denied', 404);
      }

      if (audit.auditProgram.status !== 'DRAFT') {
        throw new AppError('Cannot delete audit from a program that is not in DRAFT status', 400);
      }

      await tx.audit.delete({ where: { id: auditId } });

      await tx.auditLog.create({
        data: {
          action: 'DELETE',
          entityType: 'AUDIT',
          entityId: auditId,
          userId: deletedBy,
          tenantId,
          details: `Deleted audit ${audit.auditNo} from program: ${audit.auditProgram.title}`,
          metadata: { auditNo: audit.auditNo, type: audit.type, objectives: audit.objectives }
        }
      });

      return { success: true };
    });

    return result;
  } catch (error) {
    logger.error('Error deleting audit:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const respondToTeamAppointment = async ({ auditId, userId, status, declineReason, tenantId, responderId }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const audit = await tx.audit.findFirst({
        where: { id: auditId, auditProgram: { tenantId } }
      });
      if (!audit) throw new AppError('Audit not found or access denied', 404);
      const teamMember = await tx.auditTeamMember.findUnique({
        where: { auditId_userId: { auditId, userId } },
        include: { user: true }
      });
      if (!teamMember) throw new AppError('You are not a team member of this audit.', 404);
      if (userId !== responderId) throw new AppError('You can only respond to your own appointment.', 403);
      if (teamMember.status !== 'PENDING') throw new AppError('You have already responded to this appointment.', 400);
      // Update status, responseAt, declineReason
      const updated = await tx.auditTeamMember.update({
        where: { id: teamMember.id },
        data: {
          status,
          responseAt: new Date(),
          declineReason: status === 'DECLINED' ? declineReason : null
        },
        include: { user: true }
      });
      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'TEAM_MEMBER_RESPONSE',
          entityType: 'AUDIT',
          entityId: auditId,
          userId: responderId,
          tenantId,
          details: `Team member ${status === 'ACCEPTED' ? 'accepted' : 'declined'} appointment for audit ${audit.auditNo}`,
          metadata: { status, declineReason }
        }
      });
      // --- UPDATE APPOINTMENT MESSAGE ---
      const message = await tx.message.findFirst({
        where: {
          recipientId: userId,
          metadata: {
            path: ['auditId'],
            equals: auditId
          }
        }
      });
      if (message && !message.metadata?.response) {
        const newMetadata = {
          ...message.metadata,
          response: status,
          responseComment: status === 'DECLINED' ? declineReason : null,
          respondedAt: new Date()
        };
        const updatedMessage = await tx.message.update({
          where: { id: message.id },
          data: { metadata: newMetadata }
        });
        // Emit real-time update to the user
        try {
          const io = require('./socketService').getIO();
          io.to(`user:${userId}`).emit('messageUpdated', {
            id: message.id,
            metadata: newMetadata
          });
        } catch (e) {
          logger.error('Socket emit error (respondToTeamAppointment message):', e);
        }
      }
      // --- END UPDATE APPOINTMENT MESSAGE ---
      // --- EMIT TEAM APPOINTMENT RESPONSE TO AUDIT ROOM (MR SIDE) ---
      try {
        const io = require('./socketService').getIO();
      io.to(`audit:${auditId}`).emit('teamAppointmentResponded', {
          auditId,
          userId,
          status,
          declineReason,
          respondedAt: new Date(),
          teamMember: updated
        });
      } catch (e) {
        logger.error('Socket emit error (teamAppointmentResponded):', e);
      }
      // --- END EMIT ---
      return updated;
    });

    // --- NEW: Notify MR and Program Creators after transaction ---
    // 1. Get audit, user, and MR info
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      include: { auditProgram: true }
    });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    // 2. Find users with auditProgram:create permission (program creators)
    const programCreatorPermission = await prisma.permission.findFirst({
      where: { 
        module: 'auditProgram',
        action: 'create'
      }
    });

    let programCreators = [];
    if (programCreatorPermission) {
      programCreators = await prisma.user.findMany({
        where: {
          tenantId: audit.tenantId,
          OR: [
            {
              userRoles: {
                some: {
                  role: {
                    rolePermissions: {
                      some: {
                        permissionId: programCreatorPermission.id
                      }
                    }
                  }
                }
              }
            },
            {
              userDepartmentRoles: {
                some: {
                  role: {
                    rolePermissions: {
                      some: {
                        permissionId: programCreatorPermission.id
                      }
                    }
                  }
                }
              }
            }
          ]
        }
      });
    }

    // 3. Find MR users
    const mrRole = await prisma.role.findFirst({
      where: { 
        name: 'MR',
        tenantId: audit.tenantId 
      }
    });

    let mrUsers = [];
    if (mrRole) {
      // Only notify users whose default role is MR (either global or department-specific)
      mrUsers = await prisma.user.findMany({
        where: {
          tenantId: audit.tenantId,
          OR: [
            {
              userRoles: {
                some: {
                  isDefault: true,
                  role: { name: 'MR' }
                }
              }
            },
            {
              userDepartmentRoles: {
                some: {
                  isDefault: true,
                  role: { name: 'MR' }
                }
              }
            }
          ]
        }
      });
    }
    // Combine all users to notify (MR + Program Creators)
    const allUsersToNotify = [...mrUsers, ...programCreators];
    
    if (allUsersToNotify.length > 0) {
      const subject = "Audit Team Appointment Response";
      const teamManagementLink = `/audit-management/audits/team-management`;
      let body;
      if (status === 'ACCEPTED') {
        body = `${user.firstName} ${user.lastName} has accepted the appointment for audit "${audit.auditProgram.title}". [View Team Management](${teamManagementLink})`;
      } else if (status === 'DECLINED') {
        body = `${user.firstName} ${user.lastName} has declined the appointment for audit "${audit.auditProgram.title}". Reason: ${declineReason || 'No reason provided'}. [View Team Management](${teamManagementLink})`;
      }
      
      logger.info('Sending team appointment response notification', {
        auditId,
        userId,
        status,
        mrUserIds: mrUsers.map(u => u.id),
        programCreatorIds: programCreators.map(u => u.id),
        totalUsersToNotify: allUsersToNotify.length
      });
      
      for (const recipient of allUsersToNotify) {
        await messageService.sendMessage({
          senderId: userId,
          recipientId: recipient.id,
          tenantId: audit.auditProgram.tenantId,
          subject,
          body,
          files: []
        });
        
        const notification = await prisma.notification.create({
          data: {
            type: 'TEAM_APPOINTMENT_RESPONSE',
            title: 'Team Appointment Response',
            message: body,
            tenantId: audit.auditProgram.tenantId,
            targetUserId: recipient.id,
            link: teamManagementLink,
            metadata: {
              auditId,
              programId: audit.auditProgramId,
              status,
              declineReason
            }
          }
        });
        
        try {
          const io = require('./socketService').getIO();
          io.to(`user:${recipient.id}`).emit('notificationCreated', { ...notification, userId: recipient.id });
        } catch (e) {
          logger.error('Socket emit error (team appointment response notification):', e);
        }
      }
    } else {
      logger.warn('No users found for team appointment response notification', {
        auditId,
        tenantId: audit.tenantId,
        status,
        mrUsersCount: mrUsers.length,
        programCreatorsCount: programCreators.length
      });
    }
    // --- END NEW ---

    return result;
  } catch (error) {
    logger.error('Error responding to team appointment:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getEligibleTeamMembers = async (auditId, tenantId) => {
  // 1. Get audit and assigned team members
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: { teamMembers: true }
  });
  if (!audit) throw new AppError('Audit not found', 404);
  
  // 2. Get all users with AUDITOR or HOD AUDITOR role for the tenant (department or global)
  // TEAM_LEADER is a functional role assigned during team building, not a pre-assigned user role
  const auditorRole = await prisma.role.findFirst({ where: { name: 'AUDITOR', tenantId } });
  const hodAuditorRole = await prisma.role.findFirst({ where: { name: 'HOD AUDITOR', tenantId } });
  const roleIds = [auditorRole?.id, hodAuditorRole?.id].filter(Boolean);
  
  if (roleIds.length === 0) return [];
  
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      OR: [
        { userDepartmentRoles: { some: { roleId: { in: roleIds } } } },
        { userRoles: { some: { roleId: { in: roleIds } } } }
      ],
      id: { notIn: audit.teamMembers.map(tm => tm.userId) }
    },
    select: { 
      id: true, 
      firstName: true, 
      lastName: true, 
      email: true,
      // Include role information for better UI display
      userRoles: {
        select: {
          role: {
            select: { name: true, description: true }
          }
        }
      },
      userDepartmentRoles: {
        select: {
          role: {
            select: { name: true, description: true }
          },
          department: {
            select: { name: true }
          }
        }
      }
    }
  });
  
  // Enhance user objects with role information
  const enhancedUsers = users.map(user => {
    const userRoles = [
      ...user.userRoles.map(ur => ({ name: ur.role.name, type: 'global' })),
      ...user.userDepartmentRoles.map(udr => ({ 
        name: udr.role.name, 
        type: 'department',
        department: udr.department.name 
      }))
    ];
    
    // Determine if user is HOD AUDITOR (preferred for team leadership)
    const isHodAuditor = userRoles.some(r => r.name === 'HOD AUDITOR');
    
    return {
      ...user,
      roles: userRoles,
      isPreferredLeader: isHodAuditor // HOD AUDITORs are preferred for team leadership
    };
  });
  
  return enhancedUsers;
};

const getEligibleTeamLeaders = async (auditId, tenantId) => {
  // 1. Get audit and assigned team leader
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: { teamMembers: true }
  });
  if (!audit) throw new AppError('Audit not found', 404);
  
  // 2. Get all users with AUDITOR or HOD AUDITOR role for the tenant
  // TEAM_LEADER is a functional role assigned during team building, not a pre-assigned user role
  const auditorRole = await prisma.role.findFirst({ where: { name: 'AUDITOR', tenantId } });
  const hodAuditorRole = await prisma.role.findFirst({ where: { name: 'HOD AUDITOR', tenantId } });
  const roleIds = [auditorRole?.id, hodAuditorRole?.id].filter(Boolean);
  
  if (roleIds.length === 0) return [];
  
  // Exclude current team leader if any
  const currentLeader = audit.teamMembers.find(tm => tm.role === 'TEAM_LEADER');
  const excludeIds = currentLeader ? [currentLeader.userId] : [];
  
  const users = await prisma.user.findMany({
    where: {
      tenantId,
      OR: [
        { userDepartmentRoles: { some: { roleId: { in: roleIds } } } },
        { userRoles: { some: { roleId: { in: roleIds } } } }
      ],
      id: { notIn: excludeIds }
    },
    select: { 
      id: true, 
      firstName: true, 
      lastName: true, 
      email: true,
      // Include role information for better UI display
      userRoles: {
        select: {
          role: {
            select: { name: true, description: true }
          }
        }
      },
      userDepartmentRoles: {
        select: {
          role: {
            select: { name: true, description: true }
          },
          department: {
            select: { name: true }
          }
        }
      }
    }
  });
  
  // Enhance user objects with role information and prioritize HOD AUDITOR
  const enhancedUsers = users.map(user => {
    const userRoles = [
      ...user.userRoles.map(ur => ({ name: ur.role.name, type: 'global' })),
      ...user.userDepartmentRoles.map(udr => ({ 
        name: udr.role.name, 
        type: 'department',
        department: udr.department.name 
      }))
    ];
    
    // HOD AUDITORs are preferred for team leadership
    const isHodAuditor = userRoles.some(r => r.name === 'HOD AUDITOR');
    
    return {
      ...user,
      roles: userRoles,
      isPreferredLeader: isHodAuditor // Flag for UI to show preference
    };
  });
  
  // Sort users: HOD AUDITOR first, then regular AUDITORs
  enhancedUsers.sort((a, b) => {
    if (a.isPreferredLeader && !b.isPreferredLeader) return -1;
    if (!a.isPreferredLeader && b.isPreferredLeader) return 1;
    return 0;
  });
  
  return enhancedUsers;
};

const assignTeamLeader = async ({ auditId, teamLeaderId, tenantId, updatedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const audit = await tx.audit.findFirst({
        where: { id: auditId, auditProgram: { tenantId } },
        include: { teamMembers: true, auditProgram: { select: { id: true, title: true } } }
      });
      if (!audit) throw new AppError('Audit not found or access denied', 404);
      // Remove existing team leader if different
      const currentLeader = audit.teamMembers.find(tm => tm.role === 'TEAM_LEADER');
      if (currentLeader && currentLeader.userId !== teamLeaderId) {
        await tx.auditTeamMember.delete({ where: { id: currentLeader.id } });
      }
      // Prevent assigning as both leader and member
      const isAlreadyMember = audit.teamMembers.some(tm => tm.userId === teamLeaderId && tm.role === 'TEAM_MEMBER');
      if (isAlreadyMember) {
        throw new AppError('User is already a team member. Remove as member before assigning as leader.', 400);
      }
      // Upsert team leader with PENDING status
      const teamLeader = await tx.auditTeamMember.upsert({
        where: { auditId_userId: { auditId, userId: teamLeaderId } },
        update: { role: 'TEAM_LEADER', appointedAt: new Date(), status: 'PENDING', responseAt: null, declineReason: null },
        create: { auditId, userId: teamLeaderId, role: 'TEAM_LEADER', appointedAt: new Date(), status: 'PENDING' }
      });
      // --- ONLY CREATE MESSAGE, NO NOTIFICATION ---
      const message = await tx.message.create({
        data: {
          senderId: updatedBy,
          recipientId: teamLeaderId,
          tenantId,
          subject: `Team Appointment: Team Leader for ${audit.auditProgram.title}`,
          body: `You have been appointed as Team Leader for the audit program "${audit.auditProgram.title}" (${audit.type ? audit.type.replace(/_/g, ' ') : 'Audit'}). Please accept or decline this appointment. If declining, provide a reason.\n\n[Go to Audits](/audit-management/audits/${audit.id}/team/respond)`,
          metadata: {
            auditId,
            programId: audit.auditProgramId,
            auditNo: audit.auditNo,
            role: 'TEAM_LEADER',
            link: `/audit-management/audits/${audit.id}/team/respond`
          }
        }
      });
      try {
        const io = require('./socketService').getIO();
        io.to(`user:${teamLeaderId}`).emit('messageCreated', message);
      } catch (e) {
        logger.error('Socket emit error (assignTeamLeader message):', e);
      }
      // --- END MESSAGE CREATION ---
      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'ASSIGN_TEAM_LEADER',
          entityType: 'AUDIT',
          entityId: auditId,
          userId: updatedBy,
          tenantId,
          details: `Assigned team leader for audit ${audit.auditNo}`,
          metadata: { teamLeaderId }
        }
      });
      // Return updated audit
      const updatedAudit = await tx.audit.findFirst({
        where: { id: auditId },
        include: {
          auditProgram: { select: { id: true, title: true, status: true } },
          teamMembers: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } }
        }
      });
      return updatedAudit;
    });
    return result;
  } catch (error) {
    logger.error('Error assigning team leader:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const addTeamMembers = async ({ auditId, userIds, tenantId, updatedBy }) => {
  try {
    // 1. Fetch audit and teamMembers outside transaction
    const audit = await prisma.audit.findFirst({
      where: { id: auditId, auditProgram: { tenantId } },
      include: { teamMembers: true, auditProgram: { select: { id: true, title: true } } }
    });
    if (!audit) throw new AppError('Audit not found or access denied', 404);
    const successes = [];
    const errors = [];
    // 2. Filter userIds to add (not already leader/member)
    const toAdd = [];
    for (const userId of userIds) {
      const isLeader = audit.teamMembers.some(tm => tm.userId === userId && tm.role === 'TEAM_LEADER');
      if (isLeader) {
        errors.push({ userId, error: 'User is already the team leader. Remove as leader before assigning as member.' });
        continue;
      }
      const isAlreadyMember = audit.teamMembers.some(tm => tm.userId === userId && tm.role === 'TEAM_MEMBER');
      if (isAlreadyMember) {
        errors.push({ userId, error: 'User is already a team member.' });
        continue;
      }
      toAdd.push(userId);
    }
    // 3. Do the DB writes in a transaction (bulk if possible)
    await prisma.$transaction(async (tx) => {
      if (toAdd.length > 0) {
        // Bulk create auditTeamMembers
        await tx.auditTeamMember.createMany({
          data: toAdd.map(userId => ({
            auditId,
            userId,
            role: 'TEAM_MEMBER',
            appointedAt: new Date(),
            status: 'PENDING'
          })),
          skipDuplicates: true
        });
        // Bulk create audit logs
        await tx.auditLog.createMany({
          data: toAdd.map(userId => ({
            action: 'ADD_TEAM_MEMBER',
            entityType: 'AUDIT',
            entityId: auditId,
            userId: updatedBy,
            tenantId,
            details: `Added team member for audit ${audit.auditNo}`,
            metadata: { userId }
          }))
        });
      }
    });
    // 4. Create messages and emit sockets OUTSIDE the transaction
    for (const userId of toAdd) {
      try {
        const message = await prisma.message.create({
          data: {
            senderId: updatedBy,
            recipientId: userId,
            tenantId,
            subject: `Team Appointment: Team Member for ${audit.auditProgram.title}`,
            body: `You have been appointed as Team Member for the audit program "${audit.auditProgram.title}" (${audit.type ? audit.type.replace(/_/g, ' ') : 'Audit'}). Please accept or decline this appointment. If declining, provide a reason.\n\n[Go to Audits](/audit-management/audits/${audit.id}/team/respond)`,
            metadata: {
              auditId,
              programId: audit.auditProgramId,
              auditNo: audit.auditNo,
              role: 'TEAM_MEMBER',
              link: `/audit-management/audits/${audit.id}/team/respond`
            }
          }
        });
        try {
          const io = require('./socketService').getIO();
          io.to(`user:${userId}`).emit('messageCreated', message);
        } catch (e) {
          logger.error('Socket emit error (addTeamMember message):', e);
        }
        successes.push({ userId });
      } catch (e) {
        errors.push({ userId, error: 'Failed to create message or emit socket.' });
      }
    }
    // 5. Fetch and return updated audit
    const updatedAudit = await prisma.audit.findFirst({
      where: { id: auditId },
      include: {
        auditProgram: { select: { id: true, title: true, status: true } },
        teamMembers: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } }
      }
    });
    return { audit: updatedAudit, successes, errors };
  } catch (error) {
    logger.error('Error adding team members:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const sendGeneralAuditNotification = async ({ auditId, userId, tenantId }) => {
  // 1. Do idempotency check, fetch user IDs, and write audit log in a fast transaction
  const { userIds, auditNo, programTitle, metadata } = await prisma.$transaction(async (tx) => {
    // Fetch audit, program, tenant
    const audit = await tx.audit.findUnique({
      where: { id: auditId },
      include: {
        auditProgram: {
          select: {
            id: true,
            title: true,
            status: true,
            tenantId: true,
            tenant: { select: { id: true, name: true } }
          }
        },
      },
    });
    if (!audit) throw new AppError('Audit not found', 404);
    if (!audit.auditProgram || audit.auditProgram.status !== 'APPROVED') {
      throw new AppError('General Audit Notification can only be sent for audits in an APPROVED program', 400);
    }
    // Idempotency: check if a message of this type was sent for this audit in the last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentMessage = await tx.message.findFirst({
      where: {
        subject: 'General Audit Notification',
        metadata: { path: ['auditId'], equals: auditId },
        createdAt: { gte: fiveMinAgo },
      },
    });
    if (recentMessage) {
      throw new AppError('A General Audit Notification was already sent recently for this audit. Please wait before sending again.', 429);
    }
    // Craft structured message
    const auditType = audit.type.replace(/_/g, ' ');
    const dateFrom = audit.auditDateFrom ? new Date(audit.auditDateFrom).toLocaleDateString() : '';
    const dateTo = audit.auditDateTo ? new Date(audit.auditDateTo).toLocaleDateString() : '';
    const header = {
      program: audit.auditProgram.title,
      auditNo: auditType,
      dates: `${dateFrom} to ${dateTo}`,
    };
    const body =
      "This is to notify you that the above mentioned audit shall be undertaken on the mentioned dates and as per the audit programme.\n\n" +
      "The audit plan indicating the scope, objectives, criteria and the audit team shall be circulated by the audit team leader.\n\n" +
      "Kindly prepare accordingly.";
    const footer = "Yours Faithfully\nManagement Representative";
    const metadata = {
      auditId,
      auditNo: audit.auditNo,
      programTitle: audit.auditProgram.title,
      dateFrom,
      dateTo,
      header,
      body,
      footer,
    };
    // Get all users in the tenant
    const users = await tx.user.findMany({ where: { tenantId }, select: { id: true } });
    const userIds = users.map(u => u.id);
    // Update audit to track notification sent
    await tx.audit.update({
      where: { id: auditId },
      data: {
        generalNotificationSentAt: new Date(),
        generalNotificationSentBy: userId,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        action: 'SEND_GENERAL_AUDIT_NOTIFICATION',
        entityType: 'AUDIT',
        entityId: auditId,
        userId,
        tenantId,
        details: `General Audit Notification sent for audit ${audit.auditNo} (${audit.auditProgram.title})`,
        metadata: { auditId, programId: audit.auditProgram.id },
      },
    });
    // Only return plain data
    return { userIds, auditNo: audit.auditNo, programTitle: audit.auditProgram.title, metadata };
  });
  // 2. Create messages for all users (outside transaction)
  await Promise.all(userIds.map(uId =>
    prisma.message.create({
      data: {
        senderId: userId, // MR as sender
        recipientId: uId,
        tenantId,
        subject: 'General Audit Notification',
        body: 'A general audit notification has been issued.',
        metadata,
      },
    })
  ));
  // 3. Emit socket events after message creation
  try {
    const io = require('./socketService').getIO();
    for (const recipientId of userIds) {
      io.to(`user:${recipientId}`).emit('messageCreated', {
        subject: 'General Audit Notification',
        body: 'A general audit notification has been issued.',
        auditNo,
        programTitle,
        recipientId,
      });
    }
  } catch (e) {
    logger.error('Socket emit error (General Audit Notification as message):', e);
  }
  return { success: true };
};

// --- AUDIT PLANNING MEETING LOGIC ---

const createPlanningMeeting = async ({
  auditId,
  scheduledAtLocal,
  timeZone,
  scheduledAt,
  createdById,
  notes,
  type,
  attendance, // <-- add this for PLANNING
  agendas,
  venue,
  // Management Review specific parameters
  meetingDate,
  startTime,
  endTime
}) => {
  if (!auditId || !createdById) throw new AppError('Missing required fields: auditId, createdById', 400);
  
  // Check if a planning meeting already exists for this audit
  const existing = await prisma.auditPlanningMeeting.findFirst({
    where: { auditId, archived: false }
  });
  
  let meeting;
  let audit;
  let teamLeader;
  
  if (existing) {
    // Meeting exists - update it instead of creating a new one
    logger.info('Planning meeting already exists, updating existing meeting', {
      auditId,
      existingMeetingId: existing.id
    });
    
    // Get audit details and team members
    audit = await prisma.audit.findUnique({
      where: { id: auditId },
      include: {
        auditProgram: { select: { title: true, tenantId: true } },
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
    
    // Get the team leader (creator) details
    teamLeader = await prisma.user.findUnique({
      where: { id: createdById },
      select: { id: true, firstName: true, lastName: true, email: true }
    });
    
    // Update the existing meeting
    meeting = await prisma.auditPlanningMeeting.update({
      where: { id: existing.id },
      data: {
        notes: notes || existing.notes,
        venue: venue || existing.venue,
        updatedAt: new Date()
      }
    });
    
    // Clear existing attendance and agendas to replace with new data
    await prisma.auditPlanningAttendance.deleteMany({
      where: { meetingId: existing.id }
    });
    
    await prisma.auditPlanningAgenda.deleteMany({
      where: { meetingId: existing.id }
    });
    
    // Audit log entry for update
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE_PLANNING_MEETING',
        entityType: 'AUDIT_PLANNING_MEETING',
        entityId: meeting.id,
        userId: createdById,
        tenantId: audit.auditProgram.tenantId,
        details: `Updated planning meeting for audit ${audit.auditNo} (${audit.auditProgram.title})`,
        metadata: {
          auditId,
          meetingId: meeting.id,
          updatedAt: new Date().toISOString(),
        }
      }
    });
    
  } else {
    // No existing meeting - create a new one
    let scheduledAtUtc;
    if (scheduledAtLocal && timeZone) {
      // Convert local time + timeZone to UTC using luxon
      const dt = DateTime.fromISO(scheduledAtLocal, { zone: timeZone });
      if (!dt.isValid) {
        throw new AppError('Invalid scheduledAtLocal or timeZone', 400);
      }
      scheduledAtUtc = dt.toUTC().toJSDate();
    } else if (scheduledAt) {
      scheduledAtUtc = new Date(scheduledAt);
    } else {
      scheduledAtUtc = new Date();
    }
    
    // Always set status to ACTIVE on creation
    const initialStatus = 'ACTIVE';
    
    // 1. Do only core meeting creation and audit log in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the planning meeting
      const newMeeting = await auditRepository.createPlanningMeeting({
        auditId,
        scheduledAt: scheduledAtUtc,
        createdById,
        notes: notes || null,
        status: initialStatus,
        archived: false, // Soft delete flag
        type: type || 'PLANNING',
      });
      
      // 2. Get audit details and team members
      const auditData = await tx.audit.findUnique({
        where: { id: auditId },
        include: {
          auditProgram: { select: { title: true, tenantId: true } },
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
      if (!auditData) {
        throw new AppError('Audit not found', 404);
      }
      
      // 3. Get the team leader (creator) details
      const teamLeaderData = await tx.user.findUnique({
        where: { id: createdById },
        select: { id: true, firstName: true, lastName: true, email: true }
      });
      
      // 4. Audit log entry
      await tx.auditLog.create({
        data: {
          action: 'CREATE_PLANNING_MEETING',
          entityType: 'AUDIT_PLANNING_MEETING',
          entityId: newMeeting.id,
          userId: createdById,
          tenantId: auditData.auditProgram.tenantId,
          details: `Created planning meeting for audit ${auditData.auditNo} (${auditData.auditProgram.title})`,
          metadata: {
            auditId,
            meetingId: newMeeting.id,
            scheduledAt: scheduledAtUtc.toISOString(),
          }
        }
      });
      
      return { meeting: newMeeting, audit: auditData, teamLeader: teamLeaderData };
    });
    
    meeting = result.meeting;
    audit = result.audit;
    teamLeader = result.teamLeader;
  }
  
  // 2. Outside transaction: bulk create attendances and agendas, update venue
  let mrInviteeIds = [];
  // Save attendances for all meeting types (planning, opening, closing, etc.)
  if (Array.isArray(attendance) && attendance.length > 0) {
    await prisma.auditPlanningAttendance.createMany({
      data: attendance.map(a => ({
        meetingId: meeting.id,
        userId: a.userId,
        present: !!a.present,
        remarks: a.remarks || null
      }))
    });
    mrInviteeIds = attendance.map(a => a.userId);
  }
  
  // Save venue (only if not already set)
  if (venue && !meeting.venue) {
    await prisma.auditPlanningMeeting.update({
      where: { id: meeting.id },
      data: {
        venue: venue,
      }
    });
  }
  
  // Save agendas
  if (Array.isArray(agendas) && agendas.length > 0) {
    await prisma.auditPlanningAgenda.createMany({
      data: agendas.map((agendaText, idx) => ({
        meetingId: meeting.id,
        agendaText,
        order: idx + 1
      }))
    });
  }
  
  // --- Send invitations/messages for meetings with invitees ---
  let inviteeIds = mrInviteeIds || [];
  
  // For Management Review meetings, automatically get HODs, PRINCIPAL, HOD AUDITOR, and MR
  if (type === "MANAGEMENT_REVIEW" && (!mrInviteeIds || mrInviteeIds.length === 0)) {
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
  
  if (["MANAGEMENT_REVIEW", "OPENING", "CLOSING"].includes(type) && Array.isArray(inviteeIds) && inviteeIds.length > 0) {
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
    } else {
      // Standard invitation for other meeting types
      subject = type === 'OPENING'
        ? `Invitation: Opening Meeting for ${audit.auditProgram.title}`
        : `Invitation: Closing Meeting for ${audit.auditProgram.title}`;
      const meetingDate = new Date(meeting.scheduledAt);
      const formattedDate = meetingDate.toLocaleDateString();
      const formattedTime = meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      body = `You are invited to a ${type.replace('_', ' ').toLowerCase()} for "${audit.auditProgram.title}".\n\nMeeting Details:\n• Date: ${formattedDate}\n• Time: ${formattedTime}\n• Venue: ${venue || 'TBA'}\n\nAgendas:\n${(agendas || []).map((a, i) => `  ${i + 1}. ${a}`).join('\n')}\n\nPlease confirm your attendance.`;
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
  
  // 4. Return the meeting as before
  return meeting;
};

const getPlanningMeetingById = async (meetingId) => {
  try {
    return await auditRepository.findPlanningMeetingById(meetingId, {
      include: {
        audit: true,
        createdBy: true,
        attendances: { include: { user: true } },
        agendas: true,
      },
    });
  } catch (error) {
    logger.error('Error fetching planning meeting:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getPlanningMeetingsByAudit = async (auditId, type) => {
  try {
    console.log('🔍 Service: getPlanningMeetingsByAudit called with auditId:', auditId, 'type:', type);
    
    // Build the where clause - ensure auditId is always included
    const where = { 
      auditId: auditId,  // CRITICAL: Always filter by auditId
      archived: false 
    };
    if (type) where.type = type;
    
    console.log('🔍 Service: Query where clause:', where);
    
    const meetings = await prisma.auditPlanningMeeting.findMany({
      where,
      include: {
        audit: { select: { id: true, auditProgramId: true, auditProgram: { select: { id: true, title: true } } } },
        createdBy: true,
        attendances: { include: { user: true } },
        agendas: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });
    
    console.log('🔍 Service: Found meetings:', meetings.length);
    meetings.forEach((meeting, index) => {
      console.log(`🔍 Service: Meeting ${index + 1}:`, {
        id: meeting.id,
        auditId: meeting.auditId,
        type: meeting.type,
        status: meeting.status
      });
    });
    
    return meetings;
  } catch (error) {
    logger.error('Error fetching planning meetings by audit:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const updatePlanningMeeting = async (meetingId, updates) => {
  try {
    // Only update scalar fields on the meeting
    const { notes, status, agendaItems, attendance } = updates;

    // 1. Update meeting scalar fields
    const meeting = await prisma.auditPlanningMeeting.update({
      where: { id: meetingId },
      data: {
        ...(notes !== undefined ? { notes } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });

    // 2. Update agendas if provided
    if (Array.isArray(agendaItems)) {
      // Remove old agendas
      await prisma.auditPlanningAgenda.deleteMany({ where: { meetingId } });
      // Add new agendas
      await prisma.auditPlanningAgenda.createMany({
        data: agendaItems.map((agendaText, idx) => ({
          meetingId,
          agendaText,
          order: idx + 1
        }))
      });
    }

    // 3. Update attendance if provided
    if (Array.isArray(attendance)) {
      for (const a of attendance) {
        await prisma.auditPlanningAttendance.upsert({
          where: { meetingId_userId: { meetingId, userId: a.userId } },
          update: { present: !!a.present, remarks: a.remarks || null },
          create: { meetingId, userId: a.userId, present: !!a.present, remarks: a.remarks || null }
        });
      }
    }

    // 4. Return updated meeting with relations
    const updatedMeeting = await prisma.auditPlanningMeeting.findUnique({
      where: { id: meetingId },
      include: {
        audit: true,
        createdBy: true,
        attendances: { include: { user: true } },
        agendas: true,
      },
    });

    return updatedMeeting;
  } catch (error) {
    logger.error('Error updating planning meeting:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const archivePlanningMeeting = async (meetingId) => {
  try {
    // Soft delete: set archived = true
    return await prisma.auditPlanningMeeting.update({
      where: { id: meetingId },
      data: { archived: true },
    });
  } catch (error) {
    logger.error('Error archiving planning meeting:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const deletePlanningMeeting = async (meetingId) => {
  // For backward compatibility, call archive instead of hard delete
  return archivePlanningMeeting(meetingId);
};

// NEW: Batch update planning meeting
const batchUpdatePlanningMeeting = async ({ meetingId, attendanceUpdates, agendaUpdates, notesUpdate, statusUpdate, userId, tenantId }) => {
  try {
    // 1. Do all work except attendance upserts and final fetch in a transaction
    const txResult = await prisma.$transaction(async (tx) => {
      // 1. Verify meeting exists and user has access
      const meeting = await tx.auditPlanningMeeting.findFirst({
        where: {
          id: meetingId,
          audit: { auditProgram: { tenantId } }
        },
        include: {
          audit: { select: { auditNo: true, auditProgram: { select: { title: true } } } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });
      if (!meeting) {
        throw new AppError('Meeting not found or access denied', 404);
      }
      // 2. Check if user is team leader for this audit
      const teamMember = await tx.auditTeamMember.findUnique({
        where: { auditId_userId: { auditId: meeting.auditId, userId } }
      });
      if (!teamMember || teamMember.role !== 'TEAM_LEADER') {
        throw new AppError('Only team leaders can update meetings', 403);
      }
      const updates = {};
      // 3. Update meeting notes if provided
      if (notesUpdate !== undefined) {
        updates.notes = notesUpdate;
      }
      // 4. Update meeting status if provided
      if (statusUpdate !== undefined) {
        updates.status = statusUpdate;
      }
      // 5. Update meeting if there are changes
      if (Object.keys(updates).length > 0) {
        await tx.auditPlanningMeeting.update({
          where: { id: meetingId },
          data: updates,
        });
      }
      // 6. Process agenda updates
      if (agendaUpdates) {
        // Remove agenda items
        if (agendaUpdates.remove && agendaUpdates.remove.length > 0) {
          await tx.auditPlanningAgenda.deleteMany({
            where: { id: { in: agendaUpdates.remove } }
          });
        }
        // Add new agenda items (use createMany for efficiency)
        if (agendaUpdates.add && agendaUpdates.add.length > 0) {
          await tx.auditPlanningAgenda.createMany({
            data: agendaUpdates.add.map((agendaData) => ({
              meetingId,
              agendaText: agendaData.agendaText,
              order: agendaData.order
            })),
            skipDuplicates: true
          });
        }
        // Update discussed status for agendas
        if (agendaUpdates.update && agendaUpdates.update.length > 0) {
          for (const agendaUpdate of agendaUpdates.update) {
            if (typeof agendaUpdate.id === 'string' && typeof agendaUpdate.discussed === 'boolean') {
              await tx.auditPlanningAgenda.update({
                where: { id: agendaUpdate.id },
                data: { discussed: agendaUpdate.discussed }
              });
            }
          }
        }
      }
      // 7. Create audit log
      await tx.auditLog.create({
        data: {
          action: 'BATCH_UPDATE_PLANNING_MEETING',
          entityType: 'AUDIT_PLANNING_MEETING',
          entityId: meetingId,
          userId,
          tenantId,
          details: `Batch updated planning meeting for audit ${meeting.audit.auditNo}`,
          metadata: {
            attendanceUpdates: attendanceUpdates ? Object.keys(attendanceUpdates).length : 0,
            agendaUpdates: agendaUpdates ? (agendaUpdates.add?.length || 0) + (agendaUpdates.remove?.length || 0) + (agendaUpdates.update?.length || 0) : 0,
            notesUpdate: notesUpdate !== undefined,
            statusUpdate: statusUpdate !== undefined
          }
        }
      });
      // Only return minimal info from transaction
      return { meetingId };
    });

    // 2. Upsert attendance OUTSIDE the transaction
    const attendanceResults = [];
    if (attendanceUpdates && Object.keys(attendanceUpdates).length > 0) {
      for (const [userId, attendanceData] of Object.entries(attendanceUpdates)) {
        const attendance = await prisma.auditPlanningAttendance.upsert({
          where: { meetingId_userId: { meetingId, userId } },
          update: {
            present: attendanceData.present,
            remarks: attendanceData.remarks || null
          },
          create: {
            meetingId,
            userId,
            present: attendanceData.present,
            remarks: attendanceData.remarks || null
          },
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
        });
        attendanceResults.push(attendance);
      }
    }

    // 3. Fetch updated meeting with all relations OUTSIDE the transaction
    const finalMeeting = await prisma.auditPlanningMeeting.findUnique({
      where: { id: meetingId },
      include: {
        audit: {
          select: {
            id: true,
            auditNo: true,
            auditProgram: { select: { id: true, title: true, tenantId: true } }
          }
        },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        attendances: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        agendas: { orderBy: { order: 'asc' } },
      }
    });

    return {
      meeting: finalMeeting,
      attendanceUpdates: attendanceResults
    };
  } catch (error) {
    logger.error('Error batch updating planning meeting:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const addOrUpdateAttendance = async ({ meetingId, userId, present, remarks }) => {
  if (!meetingId || !userId) throw new AppError('Missing required fields: meetingId, userId', 400);
  try {
    const attendance = await auditRepository.upsertPlanningAttendance(
      { meetingId_userId: { meetingId, userId } },
      { meetingId, userId, present, remarks: remarks || null },
    );

    // Emit socket event to all clients in the meeting room
    try {
      const io = require('./socketService').getIO();
      io.to(`meeting:${meetingId}`).emit('attendanceUpdated', {
        meetingId,
        userId,
        present,
        attendance,
      });
    } catch (e) {
      logger.error('Socket emit error (attendanceUpdated):', e);
    }

    return attendance;
  } catch (error) {
    logger.error('Error adding/updating attendance:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getAttendancesByMeeting = async (meetingId) => {
  try {
    return await auditRepository.findAttendancesByMeeting(meetingId, { include: { user: true } });
  } catch (error) {
    logger.error('Error fetching attendances:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const addAgendaItem = async ({ meetingId, agendaText, order }) => {
  if (!meetingId || !agendaText) throw new AppError('Missing required fields: meetingId, agendaText', 400);
  try {
    return await auditRepository.createPlanningAgenda({ meetingId, agendaText, order });
  } catch (error) {
    logger.error('Error adding agenda item:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getAgendasByMeeting = async (meetingId) => {
  try {
    return await auditRepository.findAgendasByMeeting(meetingId, { orderBy: { order: 'asc' } });
  } catch (error) {
    logger.error('Error fetching agendas:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const deleteAgendaItem = async (agendaId) => {
  try {
    return await auditRepository.deleteAgenda(agendaId);
  } catch (error) {
    logger.error('Error deleting agenda item:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

// --- AUDIT EXECUTION PHASE SERVICES ---

const createAuditPlan = async ({ auditId, title, description, objectives, scope, criteria, methods, plannedStartDate, plannedEndDate, timetable, notes, requirements, createdById }) => {
  if (!auditId || !createdById) {
    throw new AppError('Missing required fields: auditId, createdById', 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify audit exists and user has access
      const audit = await tx.audit.findUnique({
        where: { id: auditId },
        include: { auditProgram: { select: { tenantId: true, title: true }, }, },
      });

      if (!audit) {
        throw new AppError('Audit not found', 404);
      }

      // Check if user is team member of this audit
      const teamMember = await tx.auditTeamMember.findUnique({
        where: { auditId_userId: { auditId, userId: createdById } }
      });

      if (!teamMember) {
        throw new AppError('You must be a team member to create an audit plan', 403);
      }

      // Enforce timetable required and well-formed (only if timetable is provided)
      if (timetable && Array.isArray(timetable) && timetable.length > 0) {
        const invalidItem = timetable.find((item) => !item || !item.activity || !item.startDate || !item.endDate || !item.responsible);
        if (invalidItem) {
          throw new AppError('Each timetable activity must include activity, startDate, endDate, and responsible', 400);
        }
      }

      // Compute the audit plan title
      const auditTypeStr = audit.type ? audit.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Audit';
      const programTitle = audit.auditProgram?.title || '';
      const computedTitle = `Audit Plan for the ${auditTypeStr} - ${programTitle}`;

      // Process rich text content to remove HTML tags
      const processedObjectives = processRichTextArray(objectives || []);
      const processedScope = Array.isArray(scope) ? scope : []; // Scope is usually just strings
      const processedCriteria = processRichTextArray(criteria || []);
      const processedMethods = processRichTextArray(methods || []);

      const auditPlan = await tx.auditPlan.create({
        data: {
          auditId,
          title: computedTitle,
          description,
          objectives: processedObjectives,
          scope: processedScope,
          criteria: processedCriteria,
          methods: processedMethods,
          plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
          plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
          timetable: timetable,
          notes: notes || null,
          requirements: requirements || null,
          createdById,
          status: 'DRAFT'
        },
        include: {
          audit: { select: { auditNo: true, type: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'CREATE_AUDIT_PLAN',
          entityType: 'AUDIT_PLAN',
          entityId: auditPlan.id,
          userId: createdById,
          tenantId: audit.auditProgram.tenantId,
          details: `Created audit plan "${computedTitle}" for audit ${audit.auditNo}`,
          metadata: { auditId, title: computedTitle, objectives: processedObjectives, scope: processedScope, criteria: processedCriteria, methods: processedMethods, timetable, notes, requirements }
        }
      });

      logger.info('Audit plan created successfully', { 
        auditPlanId: auditPlan.id, 
        auditId, 
        title: computedTitle, 
        createdById 
      });

      return auditPlan;
    });

    return result;
  } catch (error) {
    logger.error('Error creating audit plan:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getAuditPlansByAudit = async (auditId, tenantId) => {
  try {
    const auditPlans = await prisma.auditPlan.findMany({
      where: {
        auditId,
        audit: { auditProgram: { tenantId } }
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        audit: true // Only include valid relations
      },
      orderBy: { createdAt: 'desc' }
    });
    return auditPlans;
  } catch (error) {
    logger.error('Error fetching audit plans:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getAuditPlanById = async (planId, tenantId) => {
  try {
    const auditPlan = await prisma.auditPlan.findFirst({
      where: {
        id: planId,
        audit: { auditProgram: { tenantId } }
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        audit: true // Only include valid relations
      }
    });

    if (!auditPlan) {
      throw new AppError('Audit plan not found', 404);
    }

    return auditPlan;
  } catch (error) {
    logger.error('Error fetching audit plan:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const updateAuditPlan = async ({ planId, updates, tenantId, updatedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingPlan = await tx.auditPlan.findFirst({
        where: { 
          id: planId, 
          audit: { auditProgram: { tenantId } } 
        },
        include: { audit: { select: { auditNo: true } } }
      });

      if (!existingPlan) {
        throw new AppError('Audit plan not found or access denied', 404);
      }

      // DEBUG: Log planId, status, and updates
      logger.info('[DEBUG] updateAuditPlan', {
        planId,
        currentStatus: existingPlan.status,
        updates
      });

      // Only allow updates if plan is in DRAFT or REJECTED status
      if (existingPlan.status !== 'DRAFT' && existingPlan.status !== 'REJECTED') {
        throw new AppError('Cannot update audit plan that is not in DRAFT or REJECTED status', 400);
      }

      const updatedPlan = await tx.auditPlan.update({
        where: { id: planId },
        data: updates,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'UPDATE_AUDIT_PLAN',
          entityType: 'AUDIT_PLAN',
          entityId: planId,
          userId: updatedBy,
          tenantId,
          details: `Updated audit plan "${updatedPlan.title}" for audit ${existingPlan.audit.auditNo}`,
          metadata: { updates }
        }
      });

      logger.info('Audit plan updated successfully', { planId, tenantId, updatedBy });
      return updatedPlan;
    });

    return result;
  } catch (error) {
    logger.error('Error updating audit plan:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const createAuditFinding = async ({ planId, title, description, category, severity, clauseNumber, department, evidence, attachments, createdById }) => {
  if (!planId || !title || !description || !category || !severity || !createdById) {
    throw new AppError('Missing required fields: planId, title, description, category, severity, createdById', 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify audit plan exists and user has access
      const auditPlan = await tx.auditPlan.findFirst({
        where: { id: planId },
        include: { 
          audit: { 
            select: { 
              auditNo: true, 
              auditProgram: { select: { tenantId: true } } 
            } 
          } 
        }
      });

      if (!auditPlan) {
        throw new AppError('Audit plan not found', 404);
      }

      const finding = await tx.auditFinding.create({
        data: {
          auditPlanId: planId,
          title,
          description,
          category,
          severity,
          clauseNumber,
          department,
          evidence,
          attachments: attachments || [],
          createdById,
          status: 'OPEN'
        },
        include: {
          auditPlan: { select: { title: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'CREATE_FINDING',
          entityType: 'AUDIT_FINDING',
          entityId: finding.id,
          userId: createdById,
          tenantId: auditPlan.audit.auditProgram.tenantId,
          details: `Created finding "${title}" in audit plan "${auditPlan.title}"`,
          metadata: { planId, title, category, severity, clauseNumber }
        }
      });

      logger.info('Audit finding created successfully', { 
        findingId: finding.id, 
        planId, 
        title, 
        createdById 
      });

      return finding;
    });

    return result;
  } catch (error) {
    logger.error('Error creating audit finding:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const createNonConformity = async ({ planId, findingId, title, description, clauseNumber, type, severity, rootCause, createdById }) => {
  if (!planId || !title || !description || !type || !severity || !createdById) {
    throw new AppError('Missing required fields: planId, title, description, type, severity, createdById', 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify audit plan exists
      const auditPlan = await tx.auditPlan.findFirst({
        where: { id: planId },
        include: { 
          audit: { 
            select: { 
              auditNo: true, 
              auditProgram: { select: { tenantId: true } } 
            } 
          } 
        }
      });

      if (!auditPlan) {
        throw new AppError('Audit plan not found', 404);
      }

      // Verify finding exists if provided
      if (findingId) {
        const finding = await tx.auditFinding.findFirst({
          where: { id: findingId, auditPlanId: planId }
        });
        if (!finding) {
          throw new AppError('Finding not found in this audit plan', 404);
        }
      }

      const nonConformity = await tx.nonConformity.create({
        data: {
          auditPlanId: planId,
          findingId,
          title,
          description,
          clauseNumber,
          type,
          severity,
          rootCause,
          createdById,
          status: 'OPEN'
        },
        include: {
          auditPlan: { select: { title: true } },
          finding: { select: { title: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'CREATE_NON_CONFORMITY',
          entityType: 'NON_CONFORMITY',
          entityId: nonConformity.id,
          userId: createdById,
          tenantId: auditPlan.audit.auditProgram.tenantId,
          details: `Created non-conformity "${title}" in audit plan "${auditPlan.title}"`,
          metadata: { planId, findingId, title, type, severity, clauseNumber }
        }
      });

      logger.info('Non-conformity created successfully', { 
        nonConformityId: nonConformity.id, 
        planId, 
        title, 
        createdById 
      });

      return nonConformity;
    });

    return result;
  } catch (error) {
    logger.error('Error creating non-conformity:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const createCorrectiveAction = async ({ planId, nonConformityId, title, description, actionType, priority, dueDate, assignedToId, createdById }) => {
  if (!planId || !title || !description || !actionType || !priority || !createdById) {
    throw new AppError('Missing required fields: planId, title, description, actionType, priority, createdById', 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify audit plan exists
      const auditPlan = await tx.auditPlan.findFirst({
        where: { id: planId },
        include: { 
          audit: { 
            select: { 
              auditNo: true, 
              auditProgram: { select: { tenantId: true } } 
            } 
          } 
        }
      });

      if (!auditPlan) {
        throw new AppError('Audit plan not found', 404);
      }

      // Verify non-conformity exists if provided
      if (nonConformityId) {
        const nonConformity = await tx.nonConformity.findFirst({
          where: { id: nonConformityId, auditPlanId: planId }
        });
        if (!nonConformity) {
          throw new AppError('Non-conformity not found in this audit plan', 404);
        }
      }

      const correctiveAction = await tx.correctiveAction.create({
        data: {
          auditPlanId: planId,
          nonConformityId,
          title,
          description,
          actionType,
          priority,
          dueDate: dueDate ? new Date(dueDate) : null,
          assignedToId,
          createdById,
          status: 'OPEN',
          progress: 0
        },
        include: {
          auditPlan: { select: { title: true } },
          nonConformity: { select: { title: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'CREATE_CORRECTIVE_ACTION',
          entityType: 'CORRECTIVE_ACTION',
          entityId: correctiveAction.id,
          userId: createdById,
          tenantId: auditPlan.audit.auditProgram.tenantId,
          details: `Created corrective action "${title}" in audit plan "${auditPlan.title}"`,
          metadata: { planId, nonConformityId, title, actionType, priority, assignedToId }
        }
      });

      // Send notification to assigned user if any
      if (assignedToId) {
        const notification = await tx.notification.create({
          data: {
            type: 'CORRECTIVE_ACTION_ASSIGNED',
            title: 'Corrective Action Assigned',
            message: `You have been assigned a corrective action: "${title}"`,
            tenantId: auditPlan.audit.auditProgram.tenantId,
            targetUserId: assignedToId,
            link: `/audits/plans/${planId}`,
            metadata: {
              planId,
              correctiveActionId: correctiveAction.id,
              title,
              priority
            }
          }
        });

        // Emit real-time notification
        try {
          const io = socketService.getIO();
          io.to(`user:${assignedToId}`).emit('notificationCreated', { ...notification, userId: assignedToId });
        } catch (e) {
          logger.error('Socket emit error (createCorrectiveAction):', e);
        }
      }

      logger.info('Corrective action created successfully', { 
        correctiveActionId: correctiveAction.id, 
        planId, 
        title, 
        createdById 
      });

      return correctiveAction;
    });

    return result;
  } catch (error) {
    logger.error('Error creating corrective action:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const updateCorrectiveAction = async ({ actionId, updates, tenantId, updatedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingAction = await tx.correctiveAction.findFirst({
        where: { 
          id: actionId,
          auditPlan: { audit: { auditProgram: { tenantId } } }
        },
        include: { auditPlan: { select: { title: true } } }



      });

      if (!existingAction) {
        throw new AppError('Corrective action not found or access denied', 404);
      }

      const updatedAction = await tx.correctiveAction.update({
        where: { id: actionId },
        data: updates,
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          nonConformity: { select: { title: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'UPDATE_CORRECTIVE_ACTION',
          entityType: 'CORRECTIVE_ACTION',
          entityId: actionId,
          userId: updatedBy,
          tenantId,
          details: `Updated corrective action "${updatedAction.title}"`,
          metadata: { updates }
        }
      });

      logger.info('Corrective action updated successfully', { actionId, tenantId, updatedBy });
      return updatedAction;
    });

    return result;
  } catch (error) {
    logger.error('Error updating corrective action:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

// --- AUDIT CHECKLIST SERVICES ---

const createChecklist = async ({ planId, title, description, type, department, createdById, activityId }) => {
  if (!planId || !title || !type || !createdById) {
    throw new AppError('Missing required fields: planId, title, type, createdById', 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify audit plan exists and user has access
      const auditPlan = await tx.auditPlan.findFirst({
        where: { id: planId },
        include: { 
          audit: { 
            select: { 
              auditNo: true, 
              auditProgram: { select: { tenantId: true } } 
            } 
          } 
        }
      });

      if (!auditPlan) {
        throw new AppError('Audit plan not found', 404);
      }

      // If activityId provided, derive assignees from activity participants
      let assigneeIds = [];
      if (activityId) {
        // Find the activity from audit plan timetable
        const planWithTimetable = await tx.auditPlan.findUnique({ where: { id: planId } });
        const timetable = Array.isArray(planWithTimetable?.timetable) ? planWithTimetable.timetable : [];
        const activity = timetable.find((slot) => slot && (slot.id === activityId || slot.activityId === activityId));
        
        if (!activity) {
          throw new AppError('Activity not found in audit plan timetable', 404);
        }

        // Extract participants (team members)
        const participants = Array.isArray(activity.participants) ? activity.participants : [];
        // Only keep userId-like entries (ignore static tokens like ALL/AUDITORS/etc.)
        assigneeIds = participants.filter((p) => 
          typeof p === 'string' && 
          p.length > 10 && 
          !['ALL','AUDITORS','AUDITEE_MANAGEMENT','PROCESS_OWNER','STAFF'].includes(p)
        );
      }

      const checklist = await tx.checklist.create({
        data: {
          auditPlanId: planId,
          title,
          description,
          type,
          department,
          createdById,
          status: 'ACTIVE',
          ...(activityId ? { activityId } : {})
        },
        include: {
          auditPlan: { select: { title: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      // Create assignees if any were derived
      if (assigneeIds.length > 0) {
        await tx.checklistAssignee.createMany({
          data: assigneeIds.map((userId) => ({ checklistId: checklist.id, userId })),
          skipDuplicates: true
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'CREATE_CHECKLIST',
          entityType: 'CHECKLIST',
          entityId: checklist.id,
          userId: createdById,
          tenantId: auditPlan.audit.auditProgram.tenantId,
          details: `Created checklist "${title}" for audit plan "${auditPlan.title}"`,
          metadata: { 
            planId, 
            title, 
            type, 
            department, 
            activityId, 
            assigneeIds
          }
        }
      });

      logger.info('Checklist created successfully', { 
        checklistId: checklist.id, 
        planId, 
        title, 
        createdById,
        activityId,
        assigneeCount: assigneeIds.length
      });

      return checklist;
    });

    return result;
  } catch (error) {
    logger.error('Error creating checklist:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

// Helper function to extract scope/department from activity description
const extractScopeFromActivity = (activityDescription) => {
  if (!activityDescription) return null;
  
  const description = activityDescription.toLowerCase();
  
  // Common audit scope keywords mapping
  const scopeKeywords = {
    'accounting': 'Accounting',
    'finance': 'Finance',
    'hr': 'Human Resources',
    'human resources': 'Human Resources',
    'it': 'Information Technology',
    'information technology': 'Information Technology',
    'operations': 'Operations',
    'production': 'Production',
    'quality': 'Quality Management',
    'quality management': 'Quality Management',
    'safety': 'Health & Safety',
    'health': 'Health & Safety',
    'environmental': 'Environmental',
    'environment': 'Environmental',
    'procurement': 'Procurement',
    'supply chain': 'Supply Chain',
    'logistics': 'Logistics',
    'marketing': 'Marketing',
    'sales': 'Sales',
    'customer service': 'Customer Service',
    'legal': 'Legal',
    'compliance': 'Compliance',
    'risk': 'Risk Management',
    'risk management': 'Risk Management',
    'internal audit': 'Internal Audit',
    'audit': 'Internal Audit'
  };

  // Find matching keywords
  for (const [keyword, scope] of Object.entries(scopeKeywords)) {
    if (description.includes(keyword)) {
      return scope;
    }
  }

  // If no specific keyword found, try to extract from common patterns
  const patterns = [
    /audit(ing)?\s+([a-zA-Z\s]+)/i,
    /review(ing)?\s+([a-zA-Z\s]+)/i,
    /check(ing)?\s+([a-zA-Z\s]+)/i,
    /assess(ing)?\s+([a-zA-Z\s]+)/i
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[2]) {
      const extracted = match[2].trim();
      if (extracted.length > 2) {
        // Capitalize first letter of each word
        return extracted.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
      }
    }
  }

  // Default fallback
  return 'General';
};

const getChecklistsByPlan = async (planId, tenantId) => {
  try {
    const checklists = await prisma.checklist.findMany({
      where: {
        auditPlanId: planId,
        auditPlan: { audit: { auditProgram: { tenantId } } }
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: { completedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { order: 'asc' }
        },
        assignees: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return checklists;
  } catch (error) {
    logger.error('Error fetching checklists:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getChecklistById = async (checklistId, tenantId) => {
  try {
    const checklist = await prisma.checklist.findFirst({
      where: {
        id: checklistId,
        auditPlan: { audit: { auditProgram: { tenantId } } }
      },
      include: {
        auditPlan: { 
          select: { 
            id: true, 
            title: true,
            audit: { select: { auditNo: true, auditProgram: { select: { title: true, tenantId: true } } } }
          } 
        },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        items: {
          include: { completedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { order: 'asc' }
        },
        assignees: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
        }
      }
    });

    if (!checklist) {
      throw new AppError('Checklist not found', 404);
    }

    return checklist;
  } catch (error) {
    logger.error('Error fetching checklist:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const updateChecklist = async ({ checklistId, updates, tenantId, updatedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingChecklist = await tx.checklist.findFirst({
        where: { 
          id: checklistId,
          auditPlan: { audit: { auditProgram: { tenantId } } }
        },
        include: { auditPlan: { select: { title: true } } }
      });

      if (!existingChecklist) {
        throw new AppError('Checklist not found or access denied', 404);
      }

      const updatedChecklist = await tx.checklist.update({
        where: { id: checklistId },
        data: updates,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'UPDATE_CHECKLIST',
          entityType: 'CHECKLIST',
          entityId: checklistId,
          userId: updatedBy,
          tenantId,
          details: `Updated checklist "${updatedChecklist.title}"`,
          metadata: { updates }
        }
      });

      logger.info('Checklist updated successfully', { checklistId, tenantId, updatedBy });
      return updatedChecklist;
    });

    return result;
  } catch (error) {
    logger.error('Error updating checklist:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const deleteChecklist = async ({ checklistId, tenantId, deletedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const checklist = await tx.checklist.findFirst({
        where: { 
          id: checklistId,
          auditPlan: { audit: { auditProgram: { tenantId } } }
        },
        include: { auditPlan: { select: { title: true } } }
      });

      if (!checklist) {
        throw new AppError('Checklist not found or access denied', 404);
      }

      await tx.checklist.delete({ where: { id: checklistId } });

      await tx.auditLog.create({
        data: {
          action: 'DELETE_CHECKLIST',
          entityType: 'CHECKLIST',
          entityId: checklistId,
          userId: deletedBy,
          tenantId,
          details: `Deleted checklist "${checklist.title}"`,
          metadata: { title: checklist.title, type: checklist.type }
        }
      });

      return { success: true };
    });

    return result;
  } catch (error) {
    logger.error('Error deleting checklist:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const addChecklistItem = async ({ checklistId, title, description, clauseNumber, isRequired, order, createdById }) => {
  if (!checklistId || !title || !createdById) {
    throw new AppError('Missing required fields: checklistId, title, createdById', 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify checklist exists and user has access
      const checklist = await tx.checklist.findFirst({
        where: { id: checklistId },
        include: { 
          auditPlan: { 
            select: { 
              title: true,
              audit: { 
                select: { 
                  auditNo: true, 
                  auditProgram: { select: { tenantId: true } } 
                } 
              } 
            } 
          } 
        }
      });

      if (!checklist) {
        throw new AppError('Checklist not found', 404);
      }

      const checklistItem = await tx.checklistItem.create({
        data: {
          checklistId,
          title,
          description,
          clauseNumber,
          isRequired: isRequired !== undefined ? isRequired : true,
          order: order || 0,
          completed: false
        },
        include: {
          checklist: { select: { title: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'ADD_CHECKLIST_ITEM',
          entityType: 'CHECKLIST_ITEM',
          entityId: checklistItem.id,
          userId: createdById,
          tenantId: checklist.auditPlan.audit.auditProgram.tenantId,
          details: `Added item "${title}" to checklist "${checklist.title}"`,
          metadata: { checklistId, title, clauseNumber, isRequired }
        }
      });

      logger.info('Checklist item added successfully', { 
        itemId: checklistItem.id, 
        checklistId, 
        title, 
        createdById 
      });

      return checklistItem;
    });

    return result;
  } catch (error) {
    logger.error('Error adding checklist item:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const updateChecklistItem = async ({ itemId, updates, tenantId, updatedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingItem = await tx.checklistItem.findFirst({
        where: { 
          id: itemId,
          checklist: { 
            auditPlan: { audit: { auditProgram: { tenantId } } } 
          }
        },
        include: { checklist: { select: { title: true } } }
      });

      if (!existingItem) {
        throw new AppError('Checklist item not found or access denied', 404);
      }

      const updatedItem = await tx.checklistItem.update({
        where: { id: itemId },
        data: updates,
        include: {
          completedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          checklist: { select: { title: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'UPDATE_CHECKLIST_ITEM',
          entityType: 'CHECKLIST_ITEM',
          entityId: itemId,
          userId: updatedBy,
          tenantId,
          details: `Updated checklist item "${updatedItem.title}"`,
          metadata: { updates }
        }
      });

      logger.info('Checklist item updated successfully', { itemId, tenantId, updatedBy });
      return updatedItem;
    });

    return result;
  } catch (error) {
    logger.error('Error updating checklist item:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const completeChecklistItem = async ({ itemId, completed, notes, evidence, attachments, completedById, tenantId }) => {
  if (!itemId || !completedById) {
    throw new AppError('Missing required fields: itemId, completedById', 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingItem = await tx.checklistItem.findFirst({
        where: { 
          id: itemId,
          checklist: { 
            auditPlan: { audit: { auditProgram: { tenantId } } } 
          }
        },
        include: { 
          checklist: { 
            select: { 
              title: true,
              auditPlan: { select: { title: true } }
            } 
          } 
        }
      });

      if (!existingItem) {
        throw new AppError('Checklist item not found or access denied', 404);
      }

      const updateData = {
        completed,
        completedById: completed ? completedById : null,
        completedAt: completed ? new Date() : null,
        notes,
        evidence,
        attachments: attachments || []
      };

      const updatedItem = await tx.checklistItem.update({
        where: { id: itemId },
        data: updateData,
        include: {
          completedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          checklist: { select: { title: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          action: completed ? 'COMPLETE_CHECKLIST_ITEM' : 'UNCOMPLETE_CHECKLIST_ITEM',
          entityType: 'CHECKLIST_ITEM',
          entityId: itemId,
          userId: completedById,
          tenantId,
          details: `${completed ? 'Completed' : 'Uncompleted'} checklist item "${updatedItem.title}"`,
          metadata: { completed, notes, evidence, attachments }
        }
      });

      logger.info('Checklist item completion updated successfully', { 
        itemId, 
        completed, 
        completedById 
      });

      return updatedItem;
    });

    return result;
  } catch (error) {
    logger.error('Error updating checklist item completion:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const deleteChecklistItem = async ({ itemId, tenantId, deletedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.checklistItem.findFirst({
        where: { 
          id: itemId,
          checklist: { 
            auditPlan: { audit: { auditProgram: { tenantId } } } 
          }
        },
        include: { 
          checklist: { 
            select: { title: true } 
          } 
        }
      });

      if (!item) {
        throw new AppError('Checklist item not found or access denied', 404);
      }

      await tx.checklistItem.delete({ where: { id: itemId } });

      await tx.auditLog.create({
        data: {
          action: 'DELETE_CHECKLIST_ITEM',
          entityType: 'CHECKLIST_ITEM',
          entityId: itemId,
          userId: deletedBy,
          tenantId,
          details: `Deleted checklist item "${item.title}"`,
          metadata: { title: item.title }
        }
      });

      return { success: true };
    });

    return result;
  } catch (error) {
    logger.error('Error deleting checklist item:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getChecklistProgress = async (checklistId, tenantId) => {
  try {
    const checklist = await prisma.checklist.findFirst({
      where: {
        id: checklistId,
        auditPlan: { audit: { auditProgram: { tenantId } } }
      },
      include: {
        items: {
          select: {
            id: true,
            completed: true,
            isRequired: true
          }
        }
      }
    });

    if (!checklist) {
      throw new AppError('Checklist not found', 404);
    }

    const totalItems = checklist.items.length;
    const completedItems = checklist.items.filter(item => item.completed).length;
    const requiredItems = checklist.items.filter(item => item.isRequired).length;
    const completedRequiredItems = checklist.items.filter(item => item.isRequired && item.completed).length;

    const progress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const requiredProgress = requiredItems > 0 ? Math.round((completedRequiredItems / requiredItems) * 100) : 0;

    return {
      totalItems,
      completedItems,
      requiredItems,
      completedRequiredItems,
      progress,
      requiredProgress,
      isComplete: requiredItems > 0 && completedRequiredItems === requiredItems
    };
  } catch (error) {
    logger.error('Error calculating checklist progress:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

// --- MEETING STATUS MANAGEMENT SERVICES ---

const startPlanningMeeting = async ({ meetingId, userId, tenantId }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get meeting with audit details
      const meeting = await tx.auditPlanningMeeting.findFirst({
        where: {
          id: meetingId,
          audit: { auditProgram: { tenantId } }
        },
        include: {
          audit: {
            select: {
              id: true,
              auditNo: true,
              auditProgram: { select: { title: true, tenantId: true } }
            }
          },
          createdBy: { select: { id: true, firstName: true, lastName: true } }
        }
      });

      if (!meeting) {
        throw new AppError('Meeting not found or access denied', 404);
      }

      // Check if user is team leader for this audit
      const teamMember = await tx.auditTeamMember.findUnique({
        where: { auditId_userId: { auditId: meeting.auditId, userId } }
      });

      if (!teamMember || teamMember.role !== 'TEAM_LEADER') {
        throw new AppError('Only team leaders can start meetings', 403);
      }

      // Check if meeting is in the right status to start
      const meetingDate = new Date(meeting.scheduledAt);
      const now = new Date();
      // Only compare the date part (YYYY-MM-DD)
      const meetingDateStr = meetingDate.toISOString().slice(0, 10);
      const nowDateStr = now.toISOString().slice(0, 10);
      if (meetingDateStr > nowDateStr) {
        throw new AppError('Cannot start meeting before scheduled date', 400);
      }

      // Update meeting status to ACTIVE
      const updatedMeeting = await tx.auditPlanningMeeting.update({
        where: { id: meetingId },
        data: { status: 'ACTIVE' },
        include: {
          audit: { select: { auditNo: true, auditProgram: { select: { title: true } } } },
          createdBy: { select: { firstName: true, lastName: true } }
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'START_PLANNING_MEETING',
          entityType: 'AUDIT_PLANNING_MEETING',
          entityId: meetingId,
          userId,
          tenantId,
          details: `Started planning meeting for audit ${meeting.audit.auditNo} (${meeting.audit.auditProgram.title})`,
          metadata: { meetingId, auditId: meeting.auditId, startedBy: userId }
        }
      });

      // Notify team members that meeting has started
      const teamMembers = await tx.auditTeamMember.findMany({
        where: { 
          auditId: meeting.auditId,
          userId: { not: userId } // Exclude the team leader
        },
        include: { user: { select: { id: true, firstName: true, lastName: true } } }
      });

      if (teamMembers.length > 0) {
        const subject = `Meeting Started: Audit #${meeting.audit.auditNo}`;
        const body = `The planning meeting for audit #${meeting.audit.auditNo} (${meeting.audit.auditProgram.title}) has been started by ${meeting.createdBy.firstName} ${meeting.createdBy.lastName}.

You can now join the meeting to participate in the planning discussion.`;

        const messages = await Promise.all(teamMembers.map(tm => 
          tx.message.create({
            data: {
              senderId: userId,
              recipientId: tm.userId,
              tenantId,
              subject,
              body,
              metadata: {
                meetingId,
                auditId: meeting.auditId,
                auditNo: meeting.audit.auditNo,
                programTitle: meeting.audit.auditProgram.title,
                type: 'MEETING_STARTED_NOTIFICATION'
              }
            }
          })
        ));

        // Emit real-time notifications
        try {
          const io = require('./socketService').getIO();
          for (const msg of messages) {
            io.to(`user:${msg.recipientId}`).emit('messageCreated', msg);
          }
        } catch (e) {
          logger.error('Socket emit error (startPlanningMeeting):', e);
        }
      }

      logger.info('Planning meeting started successfully', {
        meetingId,
        auditId: meeting.auditId,
        startedBy: userId,
        notifiedTeamMembers: teamMembers.length
      });

      return updatedMeeting;
    });

    return result;
  } catch (error) {
    logger.error('Error starting planning meeting:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const completePlanningMeeting = async ({ meetingId, userId, tenantId }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const meeting = await tx.auditPlanningMeeting.findFirst({
        where: {
          id: meetingId,
          audit: { auditProgram: { tenantId } }
        },
        include: {
          audit: { select: { auditNo: true, auditProgram: { select: { title: true } } } }
        }
      });

      if (!meeting) {
        throw new AppError('Meeting not found or access denied', 404);
      }

      // Check if user is team leader
      const teamMember = await tx.auditTeamMember.findUnique({
        where: { auditId_userId: { auditId: meeting.auditId, userId } }
      });

      if (!teamMember || teamMember.role !== 'TEAM_LEADER') {
        throw new AppError('Only team leaders can complete meetings', 403);
      }

      // Update meeting status to COMPLETED
      const updatedMeeting = await tx.auditPlanningMeeting.update({
        where: { id: meetingId },
        data: { status: 'COMPLETED' },
        include: {
          audit: { select: { auditNo: true, auditProgram: { select: { title: true } } } }
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'COMPLETE_PLANNING_MEETING',
          entityType: 'AUDIT_PLANNING_MEETING',
          entityId: meetingId,
          userId,
          tenantId,
          details: `Completed planning meeting for audit ${meeting.audit.auditNo} (${meeting.audit.auditProgram.title})`,
          metadata: { meetingId, auditId: meeting.auditId, completedBy: userId }
        }
      });

      logger.info('Planning meeting completed successfully', {
        meetingId,
        auditId: meeting.auditId,
        completedBy: userId
      });

      return updatedMeeting;
    });

    return result;
  } catch (error) {
    logger.error('Error completing planning meeting:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const joinPlanningMeeting = async ({ meetingId, userId, tenantId }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const meeting = await tx.auditPlanningMeeting.findFirst({
        where: {
          id: meetingId,
          audit: { auditProgram: { tenantId } }
        },
        include: {
          audit: { select: { auditNo: true, auditProgram: { select: { title: true } } } }
        }
      });

      if (!meeting) {
        throw new AppError('Meeting not found or access denied', 404);
      }

      // Check if meeting is active
      if (meeting.status !== 'ACTIVE') {
        throw new AppError('Meeting is not active', 400);
      }

      // Check if user is team member
      const teamMember = await tx.auditTeamMember.findUnique({
        where: { auditId_userId: { auditId: meeting.auditId, userId } }
      });

      if (!teamMember) {
        throw new AppError('You are not a team member for this audit', 403);
      }

      // Record attendance as present
      await tx.auditPlanningAttendance.upsert({
        where: { meetingId_userId: { meetingId, userId } },
        update: { present: true, joinedAt: new Date() },
        create: { meetingId, userId, present: true, joinedAt: new Date() }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'JOIN_PLANNING_MEETING',
          entityType: 'AUDIT_PLANNING_MEETING',
          entityId: meetingId,
          userId,
          tenantId,
          details: `Joined planning meeting for audit ${meeting.audit.auditNo} (${meeting.audit.auditProgram.title})`,
          metadata: { meetingId, auditId: meeting.auditId, joinedBy: userId }
        }
      });

      logger.info('User joined planning meeting', {
        meetingId,
        auditId: meeting.auditId,
        joinedBy: userId
      });

      return meeting;
    });

    return result;
  } catch (error) {
    logger.error('Error joining planning meeting:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

// --- AUDIT PLAN APPROVAL WORKFLOW ---
const submitAuditPlanForApproval = async ({ planId, userId, tenantId }) => {
  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.auditPlan.findFirst({ 
      where: { id: planId, audit: { auditProgram: { tenantId } } }, 
      include: { 
        audit: { 
          select: { 
            id: true, 
            auditProgramId: true, 
            auditProgram: { select: { title: true } }, 
            auditNo: true 
          } 
        } 
      } 
    });
    if (!plan) throw new AppError('Audit plan not found or access denied', 404);
    if (plan.status !== 'DRAFT' && plan.status !== 'REJECTED') throw new AppError('Only DRAFT or REJECTED plans can be submitted for approval', 400);
    
    // Enforce timetable must be present and non-empty before submitting
    const planWithTimetable = await tx.auditPlan.findUnique({ where: { id: planId } });
    if (!Array.isArray(planWithTimetable?.timetable) || planWithTimetable.timetable.length === 0) {
      throw new AppError('Cannot submit audit plan without a timetable. Please create the timetable first.', 400);
    }

    // Update status
    const updatedPlan = await tx.auditPlan.update({ where: { id: planId }, data: { status: 'SUBMITTED' } });
    
    // Store notification data for permission-based sending (outside transaction)
    global.pendingAuditPlanNotification = {
      type: 'AUDIT_PLAN_APPROVAL',
      title: 'Audit Plan Submitted for Approval',
      message: `A new audit plan for program "${plan.audit.auditProgram.title}" requires your review and approval.`,
      tenantId,
      link: `/audits/${plan.audit.auditProgramId}/${plan.audit.id}/timetable/audit-plan-print?planId=${planId}`,
      metadata: { planId, auditId: plan.audit.id, programId: plan.audit.auditProgramId },
    };
    
    // Audit log
    await tx.auditLog.create({
      data: {
        action: 'SUBMIT_AUDIT_PLAN',
        entityType: 'AUDIT_PLAN',
        entityId: planId,
        userId,
        tenantId,
        details: `Audit plan submitted for approval for audit ${plan.audit.auditNo} (${plan.audit.auditProgram.title})`,
        metadata: { auditId: plan.audit.id, programId: plan.audit.auditProgramId },
      },
    });
    return { auditPlan: updatedPlan };
  });

  // Send permission-based notification outside the transaction
  try {
    if (global.pendingAuditPlanNotification) {
      await notificationService.sendNotificationToUsersWithPermission(
        global.pendingAuditPlanNotification,
        'auditProgram:create',
        tenantId
      );
      // Clean up the global variable
      delete global.pendingAuditPlanNotification;
      logger.info('Audit plan approval notification sent to users with auditProgram:create permission');
    }
  } catch (notificationError) {
    logger.error('Error sending audit plan approval notification:', notificationError);
    // Don't throw error - the main operation was successful
  }

  return result;
};


const auditPlanPdfService = require('./auditPlanPdfService');

const approveAuditPlan = async ({ planId, userId, tenantId }) => {
  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.auditPlan.findFirst({ 
      where: { id: planId, audit: { auditProgram: { tenantId } } }, 
      include: { 
        createdBy: true, 
        audit: { 
          select: { 
            id: true, 
            auditProgramId: true, 
            auditProgram: { select: { title: true } } 
          } 
        } 
      } 
    });
    if (!plan) throw new AppError('Audit plan not found or access denied', 404);
    if (plan.status !== 'SUBMITTED') throw new AppError('Only SUBMITTED plans can be approved', 400);
    
    // Enforce timetable must be present and non-empty before approval
    if (!Array.isArray(plan.timetable) || plan.timetable.length === 0) {
      throw new AppError('Cannot approve audit plan without a timetable. Please ensure the timetable is created.', 400);
    }

    // Update status
    const updatedPlan = await tx.auditPlan.update({ where: { id: planId }, data: { status: 'APPROVED' } });
    
    // Store notification data for permission-based sending (outside transaction)
    global.pendingAuditPlanApprovalNotification = {
        type: 'AUDIT_PLAN_APPROVED',
        title: 'Audit Plan Approved',
        message: `The audit plan for program "${plan.audit.auditProgram.title}" has been approved.`,
        tenantId,
      link: `/audits/${plan.audit.auditProgramId}/${plan.audit.id}/timetable/audit-plan-print?planId=${planId}`,
        metadata: { planId, auditId: plan.audit.id, programId: plan.audit.auditProgramId },
    };
    
    // Audit log
    await tx.auditLog.create({
      data: {
        action: 'APPROVE_AUDIT_PLAN',
        entityType: 'AUDIT_PLAN',
        entityId: planId,
        userId,
        tenantId,
        details: `Approved audit plan`,
        metadata: { planId }
      }
    });
    return { updatedPlan };
  });

  // Send notification to audit team members when plan is approved
  try {
    if (global.pendingAuditPlanApprovalNotification) {
      // Get audit team members
      const teamMembers = await prisma.auditTeamMember.findMany({
        where: { 
          auditId: global.pendingAuditPlanApprovalNotification.metadata.auditId,
          userId: { not: userId } // Don't send notification to the approver
        },
        include: { 
          user: { 
            select: { id: true, firstName: true, lastName: true, email: true } 
          } 
        }
      });

      if (teamMembers.length > 0) {
        // Fetch the approver's information
        const approver = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true }
        });
        
        const approverName = approver ? `${approver.firstName} ${approver.lastName}`.trim() : 'Management Representative';
        
        // Create notifications for each team member
        const notificationsData = teamMembers.map(member => ({
          type: 'AUDIT_PLAN_APPROVED',
          title: 'Audit Plan Approved',
          message: `The audit plan for program "${global.pendingAuditPlanApprovalNotification.metadata.programTitle || 'Audit Program'}" has been approved by ${approverName}.`,
          tenantId: global.pendingAuditPlanApprovalNotification.tenantId,
          targetUserId: member.user.id,
          link: global.pendingAuditPlanApprovalNotification.link,
          metadata: global.pendingAuditPlanApprovalNotification.metadata
        }));

        // Create notifications in database
        await prisma.notification.createMany({ data: notificationsData });

        // Emit real-time notifications
        try {
          const io = require('./socketService').getIO();
          for (const notification of notificationsData) {
            io.to(`user:${notification.targetUserId}`).emit('notificationCreated', {
              ...notification,
              userId: notification.targetUserId
            });
          }
        } catch (socketError) {
          logger.error('Socket emit error (approveAuditPlan):', socketError);
        }

        logger.info('Audit plan approval notification sent to team members', {
          planId,
          approvedBy: userId,
          notifiedTeamMembers: teamMembers.length
        });
      }

      // Clean up the global variable
      delete global.pendingAuditPlanApprovalNotification;
    }
  } catch (notificationError) {
    logger.error('Error sending audit plan approval notification:', notificationError);
    // Don't throw error - the main operation was successful
  }

  return { auditPlan: result.updatedPlan };
};

const rejectAuditPlan = async ({ planId, userId, tenantId, reason }) => {
  const result = await prisma.$transaction(async (tx) => {
    const plan = await tx.auditPlan.findFirst({ 
      where: { id: planId, audit: { auditProgram: { tenantId } } }, 
      include: { 
        createdBy: true, 
        audit: { 
          select: { 
            id: true, 
            auditProgramId: true, 
            auditProgram: { select: { title: true } } 
          } 
        } 
      } 
    });
    if (!plan) throw new AppError('Audit plan not found or access denied', 404);
    if (plan.status !== 'SUBMITTED') throw new AppError('Only SUBMITTED plans can be rejected', 400);
    
    // Update status
    const updatedPlan = await tx.auditPlan.update({ where: { id: planId }, data: { status: 'REJECTED' } });
    
    // Audit log - do this first to ensure it completes within transaction
    await tx.auditLog.create({
      data: {
        action: 'REJECT_AUDIT_PLAN',
        entityType: 'AUDIT_PLAN',
        entityId: planId,
        userId,
        tenantId,
        details: `Rejected audit plan`,
        metadata: { planId, reason }
      }
    });
    
    return { 
      updatedPlan, 
      plan, 
      creatorId: plan.createdBy.id 
    };
  });
  
  // Create notification outside transaction to avoid transaction issues
  let notification = null;
  try {
    notification = await createNotification({
      type: 'AUDIT_PLAN_REJECTED',
      title: 'Audit Plan Rejected',
      message: `Your audit plan for program "${result.plan.audit.auditProgram.title}" was rejected.${reason ? ' Reason: ' + reason : ''}`,
      tenantId,
      targetUserId: result.creatorId,
      link: `/audits/${result.plan.audit.auditProgramId}/${result.plan.audit.id}/timetable?planId=${planId}`,
      metadata: { planId, auditId: result.plan.audit.id, programId: result.plan.audit.auditProgramId, reason },
    });
  } catch (notificationError) {
    logger.error('Error creating rejection notification:', notificationError);
    // Don't fail the main operation if notification fails
  }
  
  // Store notification data for permission-based sending
  global.pendingAuditPlanRejectionNotification = {
    type: 'AUDIT_PLAN_REJECTED',
    title: 'Audit Plan Rejected',
    message: `Audit plan for program "${result.plan.audit.auditProgram.title}" has been rejected. Please review and resubmit.${reason ? ' Rejection reason: ' + reason : ''}`,
    tenantId,
    link: `/audits/${result.plan.audit.auditProgramId}/${result.plan.audit.id}/timetable?planId=${planId}`,
    metadata: { planId, auditId: result.plan.audit.id, programId: result.plan.audit.auditProgramId, reason },
  };
  
  // Emit socket event for creator
  try {
    if (notification) {
    const io = require('./socketService').getIO();
      io.to(`user:${result.creatorId}`).emit('notificationCreated', { ...notification, userId: result.creatorId });
    }
  } catch (e) { logger.error('Socket emit error (rejectAuditPlan creator):', e); }
  
  // Send permission-based notification outside the transaction
  try {
    if (global.pendingAuditPlanRejectionNotification) {
      await notificationService.sendNotificationToUsersWithPermission(
        global.pendingAuditPlanRejectionNotification,
        'auditProgram:create',
        tenantId
      );
      // Clean up the global variable
      delete global.pendingAuditPlanRejectionNotification;
      logger.info('Audit plan rejection notification sent to users with auditProgram:create permission');
    }
  } catch (notificationError) {
    logger.error('Error sending audit plan rejection notification:', notificationError);
    // Don't throw error - the main operation was successful
  }
  
  return { auditPlan: result.updatedPlan };
};

// --- AUDIT CHECKLIST SERVICES ---

const createChecklistWithItems = async ({ planId, title, description, type, department, items, assigneeIds, createdById }) => {
  if (!planId || !title || !type || !createdById) {
    throw new AppError('Missing required fields: planId, title, type, createdById', 400);
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('Checklist items are required', 400);
  }
  if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
    throw new AppError('Checklist assignees are required', 400);
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Verify audit plan exists and user has access
      const auditPlan = await tx.auditPlan.findFirst({
        where: { id: planId },
        include: {
          audit: {
            select: {
              auditNo: true,
              auditProgram: { select: { tenantId: true } }
            }
          }
        }
      });
      if (!auditPlan) {
        throw new AppError('Audit plan not found', 404);
      }
      // Create checklist
      const checklist = await tx.checklist.create({
        data: {
          auditPlanId: planId,
          title,
          description,
          type,
          department,
          createdById,
          status: 'ACTIVE'
        }
      });
      // Create assignees
      await Promise.all(assigneeIds.map(userId =>
        tx.checklistAssignee.create({ data: { checklistId: checklist.id, userId } })
      ));
      // Create items
      const createdItems = await Promise.all(items.map((item, idx) =>
        tx.checklistItem.create({
          data: {
            checklistId: checklist.id,
            title: item.title,
            description: item.description || '',
            clauseNumber: item.clauseNumber || '',
            isRequired: item.isRequired !== undefined ? item.isRequired : true,
            order: item.order !== undefined ? item.order : idx + 1,
            completed: false,
            attachments: item.attachments || [],
          }
        })
      ));
      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'CREATE_CHECKLIST_WITH_ITEMS',
          entityType: 'CHECKLIST',
          entityId: checklist.id,
          userId: createdById,
          tenantId: auditPlan.audit.auditProgram.tenantId,
          details: `Created checklist with items: "${title}" for audit plan "${auditPlan.title}"`,
          metadata: { planId, title, type, department, itemsCount: items.length, assigneeIds }
        }
      });

      // Return checklist with items and assignees
      const assignees = await tx.checklistAssignee.findMany({
        where: { checklistId: checklist.id },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } }
      });
      return {
        ...checklist,
        items: createdItems,
        assignees
      };
    });

    return result;
  } catch (error) {
    logger.error('Error creating checklist with items:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

// New: Update checklist with items and assignees in one request
const updateChecklistWithItemsAndAssignees = async ({ checklistId, title, description, type, department, assigneeIds, items, updatedBy, tenantId }) => {
  if (!checklistId || !updatedBy || !tenantId) {
    throw new AppError('Missing required fields: checklistId, updatedBy, tenantId', 400);
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find checklist and validate access
      const checklist = await tx.checklist.findFirst({
        where: { id: checklistId, auditPlan: { audit: { auditProgram: { tenantId } } } },
        include: { items: true, assignees: true }
      });
      if (!checklist) throw new AppError('Checklist not found or access denied', 404);
      // 2. Update meta fields
      const updatedChecklist = await tx.checklist.update({
        where: { id: checklistId },
        data: { title, description, type, department },
      });
      // 3. Upsert items
      const existingItems = checklist.items;
      const incomingItemIds = items.filter(i => i.id).map(i => i.id);
      // Delete items not in incoming list
      await tx.checklistItem.deleteMany({
        where: { checklistId, id: { notIn: incomingItemIds } }
      });
      // Upsert (update or create) items
      for (const [idx, item] of items.entries()) {
        if (item.id) {
          await tx.checklistItem.update({
            where: { id: item.id },
            data: {
              title: item.title,
              description: item.description || '',
              clauseNumber: item.clauseNumber || '',
              isRequired: item.isRequired !== undefined ? item.isRequired : true,
              order: item.order !== undefined ? item.order : idx + 1,
              attachments: item.attachments || [],
            }
          });
        } else {
          await tx.checklistItem.create({
            data: {
              checklistId,
              title: item.title,
              description: item.description || '',
              clauseNumber: item.clauseNumber || '',
              isRequired: item.isRequired !== undefined ? item.isRequired : true,
              order: item.order !== undefined ? item.order : idx + 1,
              attachments: item.attachments || [],
              completed: false
            }
          });
        }
      }
      // 4. Upsert assignees
      const existingAssigneeIds = checklist.assignees.map(a => a.userId);
      const toAdd = assigneeIds.filter(id => !existingAssigneeIds.includes(id));
      const toRemove = existingAssigneeIds.filter(id => !assigneeIds.includes(id));
      // Add new assignees
      for (const userId of toAdd) {
        await tx.checklistAssignee.create({ data: { checklistId, userId } });
      }
      // Remove missing assignees
      if (toRemove.length > 0) {
        await tx.checklistAssignee.deleteMany({ where: { checklistId, userId: { in: toRemove } } });
      }
      // 5. Audit log
      await tx.auditLog.create({
        data: {
          action: 'UPDATE_CHECKLIST_WITH_ITEMS_ASSIGNEES',
          entityType: 'CHECKLIST',
          entityId: checklistId,
          userId: updatedBy,
          tenantId,
          details: `Updated checklist (meta, items, assignees)`,
          metadata: { title, description, type, department, assigneeIds, items }
        }
      });
      // 6. Return updated checklist with items and assignees
      const resultChecklist = await tx.checklist.findFirst({
        where: { id: checklistId },
        include: {
          items: { orderBy: { order: 'asc' } },
          assignees: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } }
        }
      });
      return resultChecklist;
    });
    return result;
  } catch (error) {
    logger.error('Error updating checklist with items/assignees:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const hardDeletePlanningMeeting = async (meetingId) => {
  try {
    // Delete related attendances
    await prisma.auditPlanningAttendance.deleteMany({ where: { meetingId } });
    // Delete related agendas
    await prisma.auditPlanningAgenda.deleteMany({ where: { meetingId } });
    // Delete the meeting itself
    await prisma.auditPlanningMeeting.delete({ where: { id: meetingId } });
    return { success: true };
  } catch (error) {
    throw error;
  }
};

// Check if a general audit notification can be sent for an audit
const canSendGeneralAuditNotification = async ({ auditId, tenantId }) => {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      auditProgram: {
        select: {
          id: true,
          title: true,
          status: true,
          tenantId: true,
        }
      },
      teamMembers: {
        select: {
          id: true,
          role: true,
          status: true,
        }
      },
      generalNotificationSender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        }
      }
    },
  });

  if (!audit) {
    return {
      canSend: false,
      reason: 'Audit not found',
      code: 'AUDIT_NOT_FOUND'
    };
  }

  // Check if audit program is approved
  if (!audit.auditProgram || audit.auditProgram.status !== 'APPROVED') {
    return {
      canSend: false,
      reason: 'General Audit Notification can only be sent for audits in an APPROVED program',
      code: 'PROGRAM_NOT_APPROVED'
    };
  }

  // Note: Team member and leader assignment is no longer required for general audit notification
  // The notification can be sent as soon as the audit program is approved

  // Check if notification was already sent
  if (audit.generalNotificationSentAt) {
    const notificationTime = new Date(audit.generalNotificationSentAt);
    const now = new Date();
    const timeDiff = now.getTime() - notificationTime.getTime();
    const minutesDiff = Math.floor(timeDiff / (1000 * 60));

    if (minutesDiff < 5) {
      return {
        canSend: false,
        reason: `A General Audit Notification was already sent ${minutesDiff} minutes ago. Please wait before sending again.`,
        code: 'RECENT_NOTIFICATION',
        lastSentAt: audit.generalNotificationSentAt,
        lastSentBy: audit.generalNotificationSender,
        minutesAgo: minutesDiff
      };
    }

    // Allow resending after 5 minutes but warn user
    return {
      canSend: true,
      reason: `Notification was previously sent ${minutesDiff} minutes ago. This will send a new notification.`,
      code: 'RESEND_ALLOWED',
      lastSentAt: audit.generalNotificationSentAt,
      lastSentBy: audit.generalNotificationSender,
      minutesAgo: minutesDiff,
      warning: true
    };
  }

  // Date requirements removed: eligibility no longer depends on audit schedule dates

  return {
    canSend: true,
    reason: 'Notification can be sent',
    code: 'ELIGIBLE',
    audit: {
      id: audit.id,
      auditNo: audit.auditNo,
      type: audit.type,
      auditDateFrom: audit.auditDateFrom,
      auditDateTo: audit.auditDateTo
    }
  };
};

// Get notification status for an audit
const getGeneralAuditNotificationStatus = async ({ auditId, tenantId }) => {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: {
      id: true,
      auditNo: true,
      type: true,
      generalNotificationSentAt: true,
      generalNotificationSentBy: true,
      auditDateFrom: true,
      auditDateTo: true,
      generalNotificationSender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        }
      },
      teamMembers: {
        select: {
          id: true,
          role: true,
          status: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          }
        }
      }
    },
  });

  if (!audit) {
    return {
      exists: false,
      message: 'Audit not found'
    };
  }

  const teamMembers = audit.teamMembers || [];
  const hasTeamLeader = teamMembers.some(tm => tm.role === 'TEAM_LEADER' && tm.status === 'ACCEPTED');
  const hasTeamMembers = teamMembers.some(tm => tm.role === 'TEAM_MEMBER' && tm.status === 'ACCEPTED');

  // Use centralized eligibility logic; do not depend on team composition here
  const eligibility = await canSendGeneralAuditNotification({ auditId, tenantId });

  return {
    exists: true,
    auditId: audit.id,
    auditNo: audit.auditNo,
    type: audit.type,
    hasTeamLeader,
    hasTeamMembers,
    teamMembersCount: teamMembers.length,
    notificationSent: !!audit.generalNotificationSentAt,
    notificationSentAt: audit.generalNotificationSentAt,
    notificationSentBy: audit.generalNotificationSender,
    auditDateFrom: audit.auditDateFrom,
    auditDateTo: audit.auditDateTo,
    canSendNotification: eligibility.canSend,
    eligibilityCheck: eligibility
  };
};

// Management Review Meeting Services
const createManagementReviewMeeting = async (auditId, data) => {
  try {
    const { notes, createdBy, tenantId } = data;

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

    // Create management review meeting
    const meeting = await prisma.managementReviewMeeting.create({
      data: {
        auditId,
        notes: notes || '',
        createdBy,
        tenantId
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

    return { meeting };
  } catch (error) {
    throw error;
  }
};

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
        tenantId
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

    return { meeting };
  } catch (error) {
    throw error;
  }
};

const updateManagementReviewMeeting = async (meetingId, data, tenantId) => {
  try {
    const { notes } = data;

    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        tenantId
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    // Update meeting
    const updatedMeeting = await prisma.managementReviewMeeting.update({
      where: { id: meetingId },
      data: {
        notes: notes || ''
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

    return { meeting: updatedMeeting };
  } catch (error) {
    throw error;
  }
};

const deleteManagementReviewMeeting = async (meetingId, tenantId) => {
  try {
    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        tenantId
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    // Delete meeting (this will cascade delete minutes and attendance)
    await prisma.managementReviewMeeting.delete({
      where: { id: meetingId }
    });

    return { success: true };
  } catch (error) {
    throw error;
  }
};

const createMinuteItem = async (meetingId, data, tenantId) => {
  try {
    const { title, order, notes } = data;

    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        tenantId
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    // Create minute item
    const minute = await prisma.managementReviewMinute.create({
      data: {
        meetingId,
        title,
        order,
        notes: notes || ''
      }
    });

    return { minute };
  } catch (error) {
    throw error;
  }
};

const updateMinuteItem = async (minuteId, data, tenantId) => {
  try {
    const { notes } = data;

    // Verify minute exists and belongs to tenant
    const minute = await prisma.managementReviewMinute.findFirst({
      where: {
        id: minuteId,
        meeting: {
          tenantId
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

const deleteMinuteItem = async (minuteId, tenantId) => {
  try {
    // Verify minute exists and belongs to tenant
    const minute = await prisma.managementReviewMinute.findFirst({
      where: {
        id: minuteId,
        meeting: {
          tenantId
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

const createAttendance = async (meetingId, userId, present, tenantId) => {
  try {
    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        tenantId
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    // Verify user exists and belongs to tenant
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Create attendance record
    const attendance = await prisma.managementReviewAttendance.create({
      data: {
        meetingId,
        userId,
        present
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

    return { attendance };
  } catch (error) {
    throw error;
  }
};

const updateAttendance = async (meetingId, userId, present, tenantId) => {
  try {
    // Verify meeting exists and belongs to tenant
    const meeting = await prisma.managementReviewMeeting.findFirst({
      where: {
        id: meetingId,
        tenantId
      }
    });

    if (!meeting) {
      throw new AppError('Management review meeting not found', 404);
    }

    // Update attendance record
    const attendance = await prisma.managementReviewAttendance.update({
      where: {
        meetingId_userId: {
          meetingId,
          userId
        }
      },
      data: {
        present
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

    return { attendance };
  } catch (error) {
    throw error;
  }
};

const auditService = {
  createAudit,
  getAuditsByProgram,
  getAuditById,
  updateAudit,
  addOrUpdateTeamMember,
  removeTeamMember,
  deleteAudit,
  respondToTeamAppointment,
  getEligibleTeamMembers,
  getEligibleTeamLeaders,
  assignTeamLeader,
  addTeamMembers,
  sendGeneralAuditNotification,
  createPlanningMeeting,
  getPlanningMeetingById,
  getPlanningMeetingsByAudit,
  updatePlanningMeeting,
  deletePlanningMeeting,
  addOrUpdateAttendance,
  getAttendancesByMeeting,
  addAgendaItem,
  getAgendasByMeeting,
  deleteAgendaItem,
  createAuditPlan,
  getAuditPlansByAudit,
  getAuditPlanById,
  updateAuditPlan,
  createAuditFinding,
  createNonConformity,
  createCorrectiveAction,
  updateCorrectiveAction,
  createChecklist,
  getChecklistsByPlan,
  getChecklistById,
  updateChecklist,
  deleteChecklist,
  addChecklistItem,
  updateChecklistItem,
  completeChecklistItem,
  deleteChecklistItem,
  getChecklistProgress,
  startPlanningMeeting,
  completePlanningMeeting,
  joinPlanningMeeting,
  submitAuditPlanForApproval,
  approveAuditPlan,
  rejectAuditPlan,
  createChecklistWithItems,
  updateChecklistWithItemsAndAssignees,
  getPlanningMeetingFullDetails,
  batchUpdatePlanningMeeting,
  hardDeletePlanningMeeting,
  canSendGeneralAuditNotification,
  getGeneralAuditNotificationStatus,
  sendGeneralAuditNotification,
  createManagementReviewMeeting,
  getManagementReviewMeetingForAudit,
  updateManagementReviewMeeting,
  deleteManagementReviewMeeting,
  createMinuteItem,
  updateMinuteItem,
  deleteMinuteItem,
  createAttendance,
  updateAttendance
};

module.exports = auditService;