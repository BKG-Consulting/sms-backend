// src/services/auditProgramService.js
const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger.util');
const { AppError } = require('../../errors/app.error');
const auditProgramRepository = require('../repositories/auditProgramRepository');
const socketService = require('./socketService');
const notificationService = require('./notificationService');

const createAuditProgram = async ({ title, objectives, tenantId, createdBy }) => {
  if (!title || !objectives || !tenantId || !createdBy) {
    throw new AppError('Missing required fields: title, objectives, tenantId, createdBy', 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check if tenant exists
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId }
      });
      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      // Check if user exists and belongs to tenant
      const user = await tx.user.findUnique({
        where: { id: createdBy }
      });
      if (!user || user.tenantId !== tenantId) {
        throw new AppError('Invalid user or user does not belong to tenant', 400);
      }

      // Create audit program
      const auditProgram = await tx.auditProgram.create({
        data: {
          title,
          objectives,
          tenantId,
          createdById: createdBy,
          status: 'DRAFT'
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
          tenant: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'AUDIT_PROGRAM',
          entityId: auditProgram.id,
          userId: createdBy,
          tenantId,
          details: `Created audit program: ${title}`,
          metadata: {
            title,
            objectives,
            status: 'DRAFT'
          }
        }
      });

      logger.info('Audit program created successfully', {
        programId: auditProgram.id,
        title,
        tenantId,
        createdBy
      });

      return auditProgram;
    });

    return result;
  } catch (error) {
    logger.error('Error creating audit program:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getAuditProgramsByTenant = async (tenantId, options = {}) => {
  try {
    const { status, includeAudits = false, includeCreator = true, page = 1, limit = 10 } = options;

    const whereClause = { tenantId };
    if (status) {
      whereClause.status = status;
    }

    // Optimized select for list view
    const selectClause = {
      id: true,
      title: true,
      objectives: true,
      status: true,
      createdAt: true,
      createdBy: includeCreator ? { select: { firstName: true, lastName: true } } : undefined,
      audits: includeAudits ? { 
        select: { 
          id: true,
          auditNo: true,
          type: true,
          status: true,
          teamMembers: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
          }
        } 
      } : undefined,
    };

    const skip = (page - 1) * limit;
    const take = limit;
    const total = await prisma.auditProgram.count({ where: whereClause });
    const totalPages = Math.ceil(total / limit);

    const data = await prisma.auditProgram.findMany({
      where: whereClause,
      select: selectClause,
      orderBy: { createdAt: 'desc' },
      skip,
      take
    });

    return {
      data,
      total,
      totalPages,
      currentPage: page,
      pageSize: limit
    };
  } catch (error) {
    logger.error('Error fetching audit programs:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getAuditProgramById = async (programId, tenantId) => {
  try {
    const auditProgram = await prisma.auditProgram.findFirst({
      where: {
        id: programId,
        tenantId
      },
      select: {
        id: true,
        title: true,
        objectives: true,
        status: true,
        createdAt: true,
        createdBy: { select: { firstName: true, lastName: true, email: true } },
        audits: {
          select: {
            id: true,
            auditNo: true,
            type: true,
            status: true,
            objectives: true,
            scope: true,
            criteria: true,
            methods: true,
            auditDateFrom: true,
            auditDateTo: true,
            teamLeaderAppointmentDate: true,
            teamMemberAppointmentDate: true,
            followUpDateFrom: true,
            followUpDateTo: true,
            managementReviewDateFrom: true,
            managementReviewDateTo: true,
            generalNotificationSentAt: true,
            generalNotificationSentBy: true,
            teamMembers: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
          },
          orderBy: { auditNo: 'asc' }
        }
      }
    });

    if (!auditProgram) {
      throw new AppError('Audit program not found', 404);
    }

    return auditProgram;
  } catch (error) {
    logger.error('Error fetching audit program:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const updateAuditProgram = async ({ programId, updates, tenantId, updatedBy }) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Check if audit program exists and belongs to tenant
      const existingProgram = await tx.auditProgram.findFirst({
        where: {
          id: programId,
          tenantId
        }
      });

      if (!existingProgram) {
        throw new AppError('Audit program not found', 404);
      }

      // Only allow updates if program is in DRAFT status
      if (existingProgram.status !== 'DRAFT') {
        throw new AppError('Cannot update audit program that is not in DRAFT status', 400);
      }

      // Update audit program
      const updatedProgram = await tx.auditProgram.update({
        where: { id: programId },
        data: updates,
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          tenant: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entityType: 'AUDIT_PROGRAM',
          entityId: programId,
          userId: updatedBy,
          tenantId,
          details: `Updated audit program: ${updatedProgram.title}`,
          metadata: updates
        }
      });

      logger.info('Audit program updated successfully', {
        programId,
        updatedBy,
        updates
      });

      return updatedProgram;
    });

    return result;
  } catch (error) {
    logger.error('Error updating audit program:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const commitAuditProgram = async ({ programId, tenantId, committedBy }) => {
  try {
    await prisma.$transaction(async (tx) => {
      // Check if audit program exists and belongs to tenant
      const existingProgram = await tx.auditProgram.findFirst({
        where: {
          id: programId,
          tenantId
        },
        include: {
          audits: true
        }
      });

      if (!existingProgram) {
        throw new AppError('Audit program not found', 404);
      }

      if (existingProgram.status !== 'DRAFT') {
        throw new AppError('Only DRAFT audit programs can be committed', 400);
      }

      // Check if program has at least one audit
      if (existingProgram.audits.length === 0) {
        throw new AppError('Audit program must have at least one audit before committing', 400);
      }

      // Update audit program status to UNDER_REVIEW
      await tx.auditProgram.update({
        where: { id: programId },
        data: {
          status: 'UNDER_REVIEW',
          committedAt: new Date()
        }
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          action: 'COMMIT',
          entityType: 'AUDIT_PROGRAM',
          entityId: programId,
          userId: committedBy,
          tenantId,
          details: `Committed audit program for approval: ${existingProgram.title}`,
          metadata: {
            status: 'UNDER_REVIEW',
            committedAt: new Date()
          }
        }
      });

      // Store program data for notification (to be sent outside transaction)
      global.pendingNotification = {
        type: 'AUDIT_PROGRAM_APPROVAL',
        title: 'Audit Program Pending Approval',
        message: `New audit program "${existingProgram.title}" requires your approval.`,
        tenantId,
        link: `/audit-management/audit-programs/${programId}`,
        metadata: {
          programId,
          programTitle: existingProgram.title,
          createdBy: existingProgram.createdBy
        }
      };

      logger.info('Audit program committed successfully', {
        programId,
        committedBy,
        status: 'UNDER_REVIEW'
      });
    });

    // Send permission-based notification outside the transaction
    try {
      if (global.pendingNotification) {
        await notificationService.sendNotificationToUsersWithPermission(
          global.pendingNotification,
          'auditProgram:approve',
          tenantId
        );
        // Clean up the global variable
        delete global.pendingNotification;
        logger.info('Audit program approval notification sent to users with auditProgram:approve permission');
      }
    } catch (notificationError) {
      logger.error('Error sending audit program approval notification:', notificationError);
      // Don't throw error - the main operation was successful
    }

    // Fetch and return the fully hydrated program
    const hydratedProgram = await getAuditProgramById(programId, tenantId);
    return hydratedProgram;
  } catch (error) {
    logger.error('Error committing audit program:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const approveAuditProgram = async ({ programId, tenantId, approvedBy, approvalComment }) => {
  try {
    await prisma.$transaction(async (tx) => {
      // Check if audit program exists and belongs to tenant
      const existingProgram = await tx.auditProgram.findFirst({
        where: {
          id: programId,
          tenantId
        }
      });

      if (!existingProgram) {
        throw new AppError('Audit program not found', 404);
      }

      if (existingProgram.status !== 'UNDER_REVIEW') {
        throw new AppError('Only audit programs under review can be approved', 400);
      }

      // Update audit program status to APPROVED
      await tx.auditProgram.update({
        where: { id: programId },
        data: {
          status: 'APPROVED',
          approvedById: approvedBy,
          approvedAt: new Date(),
          approvalComment
        }
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          action: 'APPROVE',
          entityType: 'AUDIT_PROGRAM',
          entityId: programId,
          userId: approvedBy,
          tenantId,
          details: `Approved audit program: ${existingProgram.title}`,
          metadata: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvalComment
          }
        }
      });

      // Fetch all users in the tenant
      const tenantUsers = await tx.user.findMany({
        where: { tenantId },
        select: { id: true, email: true, firstName: true, lastName: true }
      });
      if (tenantUsers.length > 0) {
        // Batch notifications
        const notificationsData = tenantUsers.map(user => ({
          type: 'AUDIT_PROGRAM_APPROVED',
          title: 'Audit Program Approved',
          message: `The audit program "${existingProgram.title}" has been approved.${approvalComment ? ' Comment: ' + approvalComment : ''}`,
          tenantId,
          targetUserId: user.id,
          link: `/audit-management/audit-programs/${programId}`,
          metadata: {
            programId,
            programTitle: existingProgram.title,
            approvedBy: existingProgram.approvedBy,
            approvalComment
          }
        }));
        await tx.notification.createMany({ data: notificationsData });
        // Emit real-time notification to each user
        try {
          const io = socketService.getIO();
          for (const user of tenantUsers) {
            io.to(`user:${user.id}`).emit('notificationCreated', {
              ...notificationsData.find(n => n.targetUserId === user.id),
              userId: user.id
            });
          }
        } catch (e) {
          logger.error('Socket emit error (approveAuditProgram tenant-wide):', e);
        }
      }

      logger.info('Audit program approved successfully (tenant-wide notification)', {
        programId,
        approvedBy,
        status: 'APPROVED',
        notifiedUsers: tenantUsers.length
      });
    });
    // Fetch and return the fully hydrated program
    const hydratedProgram = await getAuditProgramById(programId, tenantId);
    return hydratedProgram;
  } catch (error) {
    logger.error('Error approving audit program:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const rejectAuditProgram = async ({ programId, tenantId, rejectedBy, rejectionComment }) => {
  try {
    await prisma.$transaction(async (tx) => {
      // Check if audit program exists and belongs to tenant
      const existingProgram = await tx.auditProgram.findFirst({
        where: {
          id: programId,
          tenantId
        }
      });

      if (!existingProgram) {
        throw new AppError('Audit program not found', 404);
      }

      if (existingProgram.status !== 'UNDER_REVIEW') {
        throw new AppError('Only audit programs under review can be rejected', 400);
      }

      // Update audit program status to DRAFT and clear approval fields
      await tx.auditProgram.update({
        where: { id: programId },
        data: {
          status: 'DRAFT',
          approvedById: null,
          approvedAt: null,
          approvalComment: rejectionComment
        }
      });

      // Create audit log entry for rejection
      await tx.auditLog.create({
        data: {
          action: 'REJECT',
          entityType: 'AUDIT_PROGRAM',
          entityId: programId,
          userId: rejectedBy,
          tenantId,
          details: `Rejected audit program: ${existingProgram.title}`,
          metadata: {
            status: 'DRAFT',
            rejectedAt: new Date(),
            rejectionComment
          }
        }
      });

      // Store rejection notification data for permission-based sending (outside transaction)
      global.pendingNotification = {
        type: 'AUDIT_PROGRAM_REJECTED',
        title: 'Audit Program Rejected',
        message: `Audit program "${existingProgram.title}" has been rejected. Please review and resubmit.${rejectionComment ? ' Rejection reason: ' + rejectionComment : ''}`,
        tenantId,
        link: `/audit-management/audit-programs/${programId}`,
        metadata: {
          programId,
          programTitle: existingProgram.title,
          rejectedBy: existingProgram.approvedBy,
          rejectionComment
        }
      };

      logger.info('Audit program rejected and set to DRAFT', {
        programId,
        rejectedBy,
        status: 'DRAFT'
      });
    });

    // Send permission-based notification outside the transaction
    try {
      if (global.pendingNotification) {
        await notificationService.sendNotificationToUsersWithPermission(
          global.pendingNotification,
          'auditProgram:create',
          tenantId
        );
        // Clean up the global variable
        delete global.pendingNotification;
        logger.info('Audit program rejection notification sent to users with auditProgram:create permission');
      }
    } catch (notificationError) {
      logger.error('Error sending audit program rejection notification:', notificationError);
      // Don't throw error - the main operation was successful
    }

    // Fetch and return the fully hydrated program
    const hydratedProgram = await getAuditProgramById(programId, tenantId);
    return hydratedProgram;
  } catch (error) {
    logger.error('Error rejecting audit program:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getAuditProgramHistory = async (programId, tenantId) => {
  // Fetch logs for the program and all its audits
  // 1. Get all audits for the program
  const program = await prisma.auditProgram.findFirst({
    where: { id: programId, tenantId },
    include: { audits: { select: { id: true } } },
  });
  if (!program) throw new AppError('Audit program not found', 404);
  const auditIds = program.audits.map(a => a.id);
  // 2. Fetch logs for the program
  const programLogs = await auditProgramRepository.findAuditLogsByEntity('AUDIT_PROGRAM', programId);
  // 3. Fetch logs for each audit
  let auditLogs = [];
  if (auditIds.length > 0) {
    auditLogs = await prisma.auditLog.findMany({
      where: {
        entityType: 'AUDIT',
        entityId: { in: auditIds },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        tenant: { select: { id: true, name: true } },
      },
    });
  }
  // 4. Combine and sort
  const allLogs = [...programLogs, ...auditLogs].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return allLogs;
};

const deleteAuditProgram = async ({ programId, tenantId, deletedBy }) => {
  try {
    await prisma.$transaction(async (tx) => {
      // Check if audit program exists and belongs to tenant
      const existingProgram = await tx.auditProgram.findFirst({
        where: {
          id: programId,
          tenantId
        },
        include: {
          audits: {
            select: {
              id: true,
              auditNo: true,
              status: true
            }
          }
        }
      });

      if (!existingProgram) {
        throw new AppError('Audit program not found', 404);
      }

      // Only allow deletion if program is in DRAFT status
      if (existingProgram.status !== 'DRAFT') {
        throw new AppError('Only DRAFT audit programs can be deleted', 400);
      }

      // Check if program has any audits that are not in DRAFT status
      const nonDraftAudits = existingProgram.audits.filter(audit => audit.status !== 'OPEN');
      if (nonDraftAudits.length > 0) {
        throw new AppError('Cannot delete audit program with non-draft audits', 400);
      }

      // Create audit log entry before deletion
      await tx.auditLog.create({
        data: {
          action: 'DELETE',
          entityType: 'AUDIT_PROGRAM',
          entityId: programId,
          userId: deletedBy,
          tenantId,
          details: `Deleted audit program: ${existingProgram.title}`,
          metadata: {
            title: existingProgram.title,
            objectives: existingProgram.objectives,
            status: existingProgram.status,
            auditCount: existingProgram.audits.length
          }
        }
      });

      // Delete the audit program (cascade will handle related records)
      await tx.auditProgram.delete({
        where: { id: programId }
      });

      logger.info('Audit program deleted successfully', {
        programId,
        deletedBy,
        title: existingProgram.title,
        auditCount: existingProgram.audits.length
      });
    });

    return { success: true };
  } catch (error) {
    logger.error('Error deleting audit program:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const exportAuditProgram = async (programId, tenantId) => {
  try {
    // Get audit program with all related data
    const auditProgram = await prisma.auditProgram.findFirst({
      where: {
        id: programId,
        tenantId
      },
      include: {
        audits: {
          include: {
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
            },
            auditPlans: true,
            planningMeetings: {
              include: {
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
            },
            findings: true,
            checklists: {
              include: {
                items: true,
                assignees: {
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
            documents: true
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
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!auditProgram) {
      throw new AppError('Audit program not found', 404);
    }

    // Create export data structure
    const exportData = {
      program: {
        id: auditProgram.id,
        title: auditProgram.title,
        objectives: auditProgram.objectives,
        status: auditProgram.status,
        createdAt: auditProgram.createdAt,
        updatedAt: auditProgram.updatedAt,
        committedAt: auditProgram.committedAt,
        approvedAt: auditProgram.approvedAt,
        approvalComment: auditProgram.approvalComment,
        createdBy: auditProgram.createdBy,
        approvedBy: auditProgram.approvedBy
      },
      audits: auditProgram.audits.map(audit => ({
        id: audit.id,
        auditNo: audit.auditNo,
        type: audit.type,
        status: audit.status,
        auditDateFrom: audit.auditDateFrom,
        auditDateTo: audit.auditDateTo,
        criteria: audit.criteria,
        methods: audit.methods,
        objectives: audit.objectives,
        scope: audit.scope,
        notes: audit.notes,
        requirements: audit.requirements,
        timetable: audit.timetable,
        teamMembers: audit.teamMembers.map(member => ({
          id: member.id,
          role: member.role,
          status: member.status,
          user: member.user
        })),
        auditPlans: audit.auditPlans,
        planningMeetings: audit.planningMeetings.map(meeting => ({
          id: meeting.id,
          scheduledAt: meeting.scheduledAt,
          status: meeting.status,
          type: meeting.type,
          venue: meeting.venue,
          notes: meeting.notes,
          attendances: meeting.attendances.map(attendance => ({
            id: attendance.id,
            present: attendance.present,
            remarks: attendance.remarks,
            user: attendance.user
          }))
        })),
        findings: audit.findings,
        checklists: audit.checklists.map(checklist => ({
          id: checklist.id,
          title: checklist.title,
          description: checklist.description,
          type: checklist.type,
          status: checklist.status,
          items: checklist.items,
          assignees: checklist.assignees.map(assignee => ({
            id: assignee.id,
            assignedAt: assignee.assignedAt,
            user: assignee.user
          }))
        })),
        documents: audit.documents
      })),
      summary: {
        totalAudits: auditProgram.audits.length,
        completedAudits: auditProgram.audits.filter(a => a.status === 'COMPLETED').length,
        openAudits: auditProgram.audits.filter(a => a.status === 'OPEN').length,
        cancelledAudits: auditProgram.audits.filter(a => a.status === 'CANCELLED').length,
        totalFindings: auditProgram.audits.reduce((sum, audit) => sum + audit.findings.length, 0),
        totalChecklists: auditProgram.audits.reduce((sum, audit) => sum + audit.checklists.length, 0),
        totalDocuments: auditProgram.audits.reduce((sum, audit) => sum + audit.documents.length, 0)
      }
    };

    logger.info('Audit program exported successfully', {
      programId,
      tenantId,
      auditCount: auditProgram.audits.length
    });

    return exportData;
  } catch (error) {
    logger.error('Error exporting audit program:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getAuditProgramStats = async (tenantId) => {
  if (!tenantId) {
    throw new AppError('Tenant ID is required', 400);
  }

  try {
    // Get audit program statistics
    const stats = await prisma.auditProgram.groupBy({
      by: ['status'],
      where: {
        tenantId: tenantId
      },
      _count: {
        id: true
      }
    });

    // Get total audit count across all programs
    const totalAudits = await prisma.audit.count({
      where: {
        auditProgram: {
          tenantId: tenantId
        }
      }
    });

    // Transform stats to the expected format
    const formattedStats = {
      total: 0,
      draft: 0,
      underReview: 0,
      approved: 0,
      rejected: 0,
      totalAudits: totalAudits
    };

    stats.forEach(stat => {
      const status = stat.status.toLowerCase();
      const count = stat._count.id;
      
      formattedStats.total += count;
      
      switch (status) {
        case 'draft':
          formattedStats.draft = count;
          break;
        case 'under_review':
          formattedStats.underReview = count;
          break;
        case 'approved':
          formattedStats.approved = count;
          break;
        case 'rejected':
          formattedStats.rejected = count;
          break;
      }
    });

    logger.info('Audit program stats retrieved successfully', { tenantId, stats: formattedStats });
    return formattedStats;
  } catch (error) {
    logger.error('Error getting audit program stats:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

module.exports = {
  createAuditProgram,
  getAuditProgramsByTenant,
  getAuditProgramById,
  updateAuditProgram,
  commitAuditProgram,
  approveAuditProgram,
  rejectAuditProgram,
  getAuditProgramHistory,
  exportAuditProgram,
  deleteAuditProgram,
  getAuditProgramStats,
};