const correctiveActionService = require('../services/correctiveActionService');
const { prisma } = require('../../prisma/client');
const NotificationDebugger = require('../utils/notificationDebugger');

async function commitCorrectionRequirement(req, res, next) {
  try {
    const correctiveActionId = req.params.id;
    const data = req.body;
    const userId = req.user.userId; // Use userId as set by auth middleware
    
    console.log(`🔍 [CONTROLLER] commitCorrectionRequirement called for ID: ${correctiveActionId} by user: ${userId}`);
    
    const result = await correctiveActionService.commitCorrectionRequirement({ correctiveActionId, data, userId });
    
    // Prepare response based on notification results
    const successfulNotifications = result.notificationResults.filter(r => r.status === 'SUCCESS').length;
    const partialSuccess = result.notificationResults.filter(r => r.status === 'PARTIAL_SUCCESS').length;
    const failedNotifications = result.notificationResults.filter(r => r.status === 'FAILED').length;
    
    let message = 'Correction requirement committed successfully.';
    let status = 200;
    
    if (successfulNotifications > 0) {
      message += ` HOD notified successfully (${successfulNotifications} notification${successfulNotifications > 1 ? 's' : ''}).`;
    }
    
    if (partialSuccess > 0) {
      message += ` ${partialSuccess} HOD notification${partialSuccess > 1 ? 's' : ''} partially sent (database notification created, real-time notification failed).`;
    }
    
    if (failedNotifications > 0) {
      message += ` ${failedNotifications} HOD notification${failedNotifications > 1 ? 's' : ''} failed.`;
      status = 207; // Multi-Status: Some operations succeeded, some failed
    }
    
    if (!result.hasSuccessfulNotifications) {
      message = 'Correction requirement committed, but HOD notification failed. Please check department configuration.';
      status = 207; // Multi-Status
    }
    
    console.log(`✅ [CONTROLLER] commitCorrectionRequirement completed with status: ${status}`, {
      correctiveActionId,
      successfulNotifications,
      partialSuccess,
      failedNotifications,
      hasSuccessfulNotifications: result.hasSuccessfulNotifications
    });
    
    res.status(status).json({ 
      success: true, 
      message,
      notificationSummary: {
        total: result.notificationResults.length,
        successful: successfulNotifications,
        partialSuccess,
        failed: failedNotifications,
        hasSuccessfulNotifications: result.hasSuccessfulNotifications
      },
      notificationDetails: result.notificationResults
    });
  } catch (err) {
    console.error(`❌ [CONTROLLER] commitCorrectionRequirement failed:`, {
      error: err.message,
      stack: err.stack,
      correctiveActionId: req.params.id,
      userId: req.user.userId
    });
    next(err);
  }
}

async function createCorrectiveActionForNonConformity(req, res, next) {
  try {
    const { nonConformityId } = req.params;
    const userId = req.user.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    // Check if one already exists
    let correctiveAction = await prisma.correctiveAction.findFirst({
      where: { nonConformityId }
    });
    if (!correctiveAction) {
      correctiveAction = await prisma.correctiveAction.create({
        data: {
          nonConformityId,
          createdById: userId,
          title: req.body.title || "Corrective Action",
          description: req.body.description || "",
          actionType: req.body.actionType || "CORRECTIVE",
          priority: req.body.priority || "MEDIUM"
        }
      });
    }
    res.status(200).json({ success: true, correctiveAction });
  } catch (err) {
    next(err);
  }
}

async function getCorrectiveActionById(req, res, next) {
  try {
    const { id } = req.params;
    let correctiveAction = await prisma.correctiveAction.findUnique({
      where: { id },
      include: {
        nonConformity: true,
        assignedTo: true,
        createdBy: true,
      },
    });
    if (!correctiveAction) {
      return res.status(404).json({ success: false, message: 'Corrective action not found' });
    }
    // Populate appropriatenessReview.auditor
    if (correctiveAction.appropriatenessReview?.auditorId) {
      const auditor = await prisma.user.findUnique({
        where: { id: correctiveAction.appropriatenessReview.auditorId },
        select: { firstName: true, lastName: true, email: true }
      });
      correctiveAction.appropriatenessReview.auditor = auditor;
    }
    // Populate followUpAction.auditor
    if (correctiveAction.followUpAction?.updatedBy) {
      const auditor = await prisma.user.findUnique({
        where: { id: correctiveAction.followUpAction.updatedBy },
        select: { firstName: true, lastName: true, email: true }
      });
      correctiveAction.followUpAction.auditor = auditor;
    }
    // Populate actionEffectiveness.auditor
    if (correctiveAction.actionEffectiveness?.auditorId) {
      const auditor = await prisma.user.findUnique({
        where: { id: correctiveAction.actionEffectiveness.auditorId },
        select: { firstName: true, lastName: true, email: true }
      });
      correctiveAction.actionEffectiveness.auditor = auditor;
    }
    res.status(200).json({ success: true, correctiveAction });
  } catch (err) {
    next(err);
  }
}

async function updateCorrectiveAction(req, res, next) {
  try {
    const { id } = req.params;
    const data = req.body;
    // Only allow updating certain fields (e.g., proposedAction, dueDate, etc.)
    const allowedFields = ['proposedAction', 'dueDate', 'status', 'priority', 'assignedToId'];
    const updateData = Object.fromEntries(Object.entries(data).filter(([k]) => allowedFields.includes(k)));
    // If proposedAction is being updated, clear appropriatenessReview
    if (updateData.proposedAction) {
      updateData.appropriatenessReview = null;
    }
    const updated = await prisma.correctiveAction.update({
      where: { id },
      data: updateData,
      include: {
        nonConformity: true,
        assignedTo: true,
        createdBy: true,
      },
    });

    // If proposedAction is being submitted, notify the auditor who created the corrective action requirement
    if (updateData.proposedAction && updated.createdById) {
      const notificationRepository = require('../repositories/notification.repository');
      await notificationRepository.createNotification({
        type: 'ROOT_CAUSE_ANALYSIS_SUBMITTED',
        title: 'Root Cause Analysis Submitted',
        message: `The HOD has submitted a root cause analysis for corrective action: ${updated.title}.`,
        tenantId: updated.createdBy.tenantId,
        targetUserId: updated.createdById,
        link: `/auditors/corrective-actions/${updated.nonConformityId}`,
        metadata: { correctiveActionId: updated.id, nonConformityId: updated.nonConformityId },
      });
      // Emit real-time notification to the auditor
      try {
        const socketService = require('../services/socketService');
        const io = socketService.getIO();
        io.to(`user:${updated.createdById}`).emit('notificationCreated', {
          type: 'ROOT_CAUSE_ANALYSIS_SUBMITTED',
          title: 'Root Cause Analysis Submitted',
          message: `The HOD has submitted a root cause analysis for corrective action: ${updated.title}.`,
          tenantId: updated.createdBy.tenantId,
          targetUserId: updated.createdById,
          link: `/auditors/corrective-actions/${updated.nonConformityId}`,
          metadata: { correctiveActionId: updated.id, nonConformityId: updated.nonConformityId },
          userId: updated.createdById,
        });
      } catch (err) {
        console.error('Failed to emit real-time notification to auditor:', err);
      }
    }

    res.status(200).json({ success: true, correctiveAction: updated });
  } catch (err) {
    next(err);
  }
}

async function submitAppropriatenessReview(req, res, next) {
  try {
    const { id } = req.params;
    const { response, comment, commit } = req.body;
    const auditorId = req.user.id || req.user.userId;
    if (!auditorId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    if (!['YES', 'NO'].includes(response)) return res.status(400).json({ success: false, message: 'Response must be YES or NO' });
    if (response === 'NO' && (!comment || comment.trim() === '')) return res.status(400).json({ success: false, message: 'Comment is required when response is NO' });
    // Update the appropriatenessReview field
    const appropriatenessReview = {
      auditorId,
      response,
      comment: response === 'NO' ? comment : undefined,
      respondedAt: new Date().toISOString(),
    };
    const updated = await prisma.correctiveAction.update({
      where: { id },
      data: { appropriatenessReview },
      include: {
        nonConformity: {
          include: {
            finding: true
          }
        },
        assignedTo: true,
        createdBy: true,
      },
    });
    // If commit is true, notify the HOD
    if (commit && updated.nonConformity) {
      const departmentName = updated.nonConformity.finding?.department;
      const tenantId = updated.createdBy.tenantId;
      const department = await prisma.department.findFirst({ 
        where: { 
          name: departmentName,
          tenantId: tenantId
        }
      });
      if (department && department.hodId) {
        const notificationRepository = require('../repositories/notification.repository');
        await notificationRepository.createNotification({
          type: 'APPROPRIATENESS_REVIEWED',
          title: 'Appropriateness Review Completed',
          message: `The auditor has reviewed the appropriateness of the proposed action for a non-conformity in your department.`,
          tenantId: updated.createdBy.tenantId,
          targetUserId: department.hodId,
          link: `/auditors/corrective-actions/${updated.nonConformityId}`,
          metadata: { correctiveActionId: updated.id, nonConformityId: updated.nonConformityId },
        });
        // Emit real-time notification to the HOD
        try {
          const socketService = require('../services/socketService');
          const io = socketService.getIO();
          io.to(`user:${department.hodId}`).emit('notificationCreated', {
            type: 'APPROPRIATENESS_REVIEWED',
            title: 'Appropriateness Review Completed',
            message: `The auditor has reviewed the appropriateness of the proposed action for a non-conformity in your department.`,
            tenantId: updated.createdBy.tenantId,
            targetUserId: department.hodId,
            link: `/auditors/corrective-actions/${updated.nonConformityId}`,
            metadata: { correctiveActionId: updated.id, nonConformityId: updated.nonConformityId },
            userId: department.hodId,
          });
        } catch (err) {
          console.error('Failed to emit real-time notification to HOD:', err);
        }
      }
    }
    res.status(200).json({ success: true, correctiveAction: updated });
  } catch (err) {
    next(err);
  }
}

async function submitFollowUpAction(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const auditorId = req.user.id || req.user.userId;
    if (!auditorId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    if (!['ACTION_FULLY_COMPLETED', 'ACTION_PARTIALLY_COMPLETED', 'NO_ACTION_TAKEN'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid follow up action status' });
    }
    
    const followUpAction = {
      action: status, // e.g. 'ACTION_FULLY_COMPLETED'
      status: status === 'ACTION_FULLY_COMPLETED' ? 'CLOSED' : 'OPEN',
      updatedBy: auditorId,
      updatedAt: new Date().toISOString(),
    };
    
    // Update corrective action status based on follow-up action
    let correctiveActionStatus = 'IN_PROGRESS'; // Default
    if (status === 'ACTION_FULLY_COMPLETED') {
      correctiveActionStatus = 'COMPLETED';
    } else if (status === 'ACTION_PARTIALLY_COMPLETED') {
      correctiveActionStatus = 'IN_PROGRESS';
    } else if (status === 'NO_ACTION_TAKEN') {
      correctiveActionStatus = 'OPEN';
    }
    
    const updated = await prisma.correctiveAction.update({
      where: { id },
      data: { 
        followUpAction,
        status: correctiveActionStatus
      },
      include: {
        nonConformity: true,
        assignedTo: true,
        createdBy: true,
      },
    });
    res.status(200).json({ success: true, correctiveAction: updated });
  } catch (err) {
    next(err);
  }
}

async function submitActionEffectiveness(req, res, next) {
  try {
    const { id } = req.params;
    const { response, details } = req.body;
    const auditorId = req.user.id || req.user.userId;
    if (!auditorId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    if (!['YES', 'NO'].includes(response)) return res.status(400).json({ success: false, message: 'Response must be YES or NO' });
    if (!details) return res.status(400).json({ success: false, message: 'Details are required' });
    
    const actionEffectiveness = {
      response,
      details,
      status: response === 'YES' ? 'CLOSED' : 'OPEN',
      auditorId,
      reviewedAt: new Date().toISOString(),
    };
    
    // Update corrective action status based on effectiveness review
    let correctiveActionStatus = 'COMPLETED'; // Default (assuming follow-up was completed)
    if (response === 'YES') {
      correctiveActionStatus = 'VERIFIED'; // Action was effective
    } else {
      correctiveActionStatus = 'IN_PROGRESS'; // Action was not effective, needs rework
    }
    
    const updated = await prisma.correctiveAction.update({
      where: { id },
      data: { 
        actionEffectiveness,
        status: correctiveActionStatus
      },
      include: {
        nonConformity: true,
        assignedTo: true,
        createdBy: true,
      },
    });
    res.status(200).json({ success: true, correctiveAction: updated });
  } catch (err) {
    next(err);
  }
}

const messageService = require('../services/messageService');

async function notifyMR(req, res, next) {
  try {
    const correctiveActionId = req.params.id;
    const { comment } = req.body;
    const senderId = req.user.id || req.user.userId;
    
    console.log(`🔍 [MR_NOTIFICATION] Starting MR notification for corrective action: ${correctiveActionId} by user: ${senderId}`);
    
    // Fetch corrective action with all necessary relations
    const correctiveAction = await prisma.correctiveAction.findUnique({
      where: { id: correctiveActionId },
      include: {
        nonConformity: {
          include: {
            finding: {
              include: {
                audit: {
                  include: {
                    auditProgram: true
                  }
                }
              }
            }
          }
        },
        assignedTo: true,
        createdBy: true,
      },
    });
    
    if (!correctiveAction) {
      console.error(`❌ [MR_NOTIFICATION] Corrective action not found: ${correctiveActionId}`);
      return res.status(404).json({ success: false, message: 'Corrective action not found' });
    }
    
    const tenantId = correctiveAction.nonConformity?.finding?.audit?.auditProgram?.tenantId;
    if (!tenantId) {
      console.error(`❌ [MR_NOTIFICATION] Tenant ID not found for corrective action: ${correctiveActionId}`);
      return res.status(400).json({ success: false, message: 'Tenant ID not found' });
    }
    
    console.log(`🔍 [MR_NOTIFICATION] Found tenant ID: ${tenantId}`);
    
    // Find MR role first
    const mrRole = await prisma.role.findFirst({
      where: { 
        name: 'MR',
        tenantId 
      }
    });
    
    console.log(`🔍 [MR_NOTIFICATION] MR role lookup result:`, {
      foundMRRole: !!mrRole,
      mrRoleId: mrRole?.id,
      mrRoleName: mrRole?.name,
      tenantId
    });
    
    if (!mrRole) {
      console.error(`❌ [MR_NOTIFICATION] MR role not found for tenant: ${tenantId}`);
      return res.status(404).json({ success: false, message: 'MR role not found for this tenant' });
    }
    
    // Find the MR for the tenant (following the same pattern as HOD lookup)
    const mrUser = await prisma.user.findFirst({
      where: {
        tenantId,
        OR: [
          { userRoles: { some: { roleId: mrRole.id } } },
          { userDepartmentRoles: { some: { roleId: mrRole.id } } }
        ]
      },
      include: {
        userRoles: {
          include: { role: true }
        },
        userDepartmentRoles: {
          include: { role: true }
        }
      }
    });
    
    console.log(`🔍 [MR_NOTIFICATION] MR user lookup result:`, {
      foundMRUser: !!mrUser,
      mrUserId: mrUser?.id,
      mrUserEmail: mrUser?.email,
      mrUserName: mrUser ? `${mrUser.firstName} ${mrUser.lastName}` : null,
      userRoles: mrUser?.userRoles?.map(ur => ur.role.name),
      userDepartmentRoles: mrUser?.userDepartmentRoles?.map(udr => udr.role.name)
    });
    
    if (!mrUser) {
      console.error(`❌ [MR_NOTIFICATION] MR user not found for tenant: ${tenantId} with role ID: ${mrRole.id}`);
      return res.status(404).json({ success: false, message: 'MR user not found for this tenant' });
    }
    
    // Create notification for MR (following the same pattern as HOD notification)
    console.log(`📬 [MR_NOTIFICATION] Creating notification for MR: ${mrUser.id} (${mrUser.email})`);
    
    const notificationRepository = require('../repositories/notification.repository');
    try {
      const notification = await notificationRepository.createNotification({
        type: 'CORRECTIVE_ACTION_MR_NOTIFICATION',
        title: 'Corrective Action Requires MR Review',
        message: `A corrective action requires your review. ${comment ? `Comment: ${comment}` : ''}`,
        tenantId: tenantId,
        targetUserId: mrUser.id,
        link: `/auditors/corrective-actions/${correctiveAction.nonConformityId}`,
        metadata: { 
          correctiveActionId: correctiveAction.id, 
          nonConformityId: correctiveAction.nonConformityId,
          notifiedBy: senderId,
          comment: comment
        },
      });
      
      console.log(`✅ [MR_NOTIFICATION] Successfully created notification:`, {
        notificationId: notification.id,
        type: notification.type,
        targetUserId: notification.targetUserId,
        link: notification.link
      });
    } catch (notificationErr) {
      console.error(`❌ [MR_NOTIFICATION] Failed to create notification for MR: ${mrUser.id}`, {
        error: notificationErr.message,
        stack: notificationErr.stack,
        mrUserId: mrUser.id,
        mrUserEmail: mrUser.email
      });
      throw notificationErr;
    }
    
    // Emit real-time notification to the MR
    try {
      console.log(`🔌 [MR_NOTIFICATION] Attempting to send real-time notification to MR: ${mrUser.id}`);
      
      const socketService = require('../services/socketService');
      const io = socketService.getIO();
      
      if (!io) {
        console.warn(`⚠️ [MR_NOTIFICATION] Socket.io not initialized, skipping real-time notification`);
      } else {
        io.to(`user:${mrUser.id}`).emit('notificationCreated', {
          type: 'CORRECTIVE_ACTION_MR_NOTIFICATION',
          title: 'Corrective Action Requires MR Review',
          message: `A corrective action requires your review. ${comment ? `Comment: ${comment}` : ''}`,
          tenantId: tenantId,
          targetUserId: mrUser.id,
          link: `/auditors/corrective-actions/${correctiveAction.nonConformityId}`,
          metadata: { 
            correctiveActionId: correctiveAction.id, 
            nonConformityId: correctiveAction.nonConformityId,
            notifiedBy: senderId,
            comment: comment
          },
          userId: mrUser.id,
        });
        
        console.log(`✅ [MR_NOTIFICATION] Successfully sent real-time notification to MR: ${mrUser.id}`);
      }
    } catch (err) {
      console.error(`❌ [MR_NOTIFICATION] Failed to emit real-time notification to MR: ${mrUser.id}`, {
        error: err.message,
        stack: err.stack,
        mrUserId: mrUser.id,
        mrUserEmail: mrUser.email
      });
    }
    
    // Update the corrective action to mark MR as notified
    console.log(`📝 [MR_NOTIFICATION] Updating corrective action to mark MR as notified: ${correctiveActionId}`);
    
    await prisma.correctiveAction.update({
      where: { id: correctiveActionId },
      data: { mrNotified: true }
    });
    
    console.log(`✅ [MR_NOTIFICATION] MR notification completed successfully for:`, {
      correctiveActionId,
      mrUserId: mrUser.id,
      mrUserEmail: mrUser.email,
      mrUserName: `${mrUser.firstName} ${mrUser.lastName}`,
      comment: comment || 'No comment provided'
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'MR notified successfully',
      mrUser: {
        id: mrUser.id,
        email: mrUser.email,
        firstName: mrUser.firstName,
        lastName: mrUser.lastName
      }
    });
  } catch (err) {
    next(err);
  }
}

async function debugNotificationIssues(req, res, next) {
  try {
    const { correctiveActionId } = req.params;
    
    if (!correctiveActionId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Corrective action ID is required' 
      });
    }
    
    console.log(`🔍 [DEBUG] Debug notification issues requested for corrective action: ${correctiveActionId}`);
    
    const debugReport = await NotificationDebugger.generateDebugReport(correctiveActionId);
    
    if (debugReport.error) {
      return res.status(404).json({
        success: false,
        message: debugReport.error,
        debugData: debugReport
      });
    }
    
    console.log(`✅ [DEBUG] Debug report generated successfully for: ${correctiveActionId}`, {
      overallStatus: debugReport.summary.overallStatus,
      issuesCount: debugReport.summary.issues.length
    });
    
    res.status(200).json({
      success: true,
      message: 'Debug report generated successfully',
      debugReport
    });
    
  } catch (error) {
    console.error(`❌ [DEBUG] Debug notification issues failed:`, {
      error: error.message,
      stack: error.stack,
      correctiveActionId: req.params.correctiveActionId
    });
    next(error);
  }
}

module.exports = {
  commitCorrectionRequirement,
  createCorrectiveActionForNonConformity,
  getCorrectiveActionById,
  updateCorrectiveAction,
  submitAppropriatenessReview,
  submitFollowUpAction,
  submitActionEffectiveness,
  notifyMR,
  debugNotificationIssues,
}; 
  