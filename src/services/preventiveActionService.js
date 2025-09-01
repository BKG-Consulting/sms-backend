const { prisma } = require('../../prisma/client');
const { AppError } = require('../../errors/app.error');
const notificationRepository = require('../repositories/notification.repository');
const messageService = require('./messageService');

async function updateObservationRequirement({ id, area, observation, evidence, auditor, userId }) {
  console.log(`🔍 [PREVENTIVE_ACTION] Starting observation requirement commit for ID: ${id} by user: ${userId}`);
  
  // 1. Fetch the improvement opportunity and related finding
  const improvementOpportunity = await prisma.improvementOpportunity.findUnique({
    where: { id },
    include: {
      finding: {
        include: {
          audit: {
            include: {
              auditProgram: {
                select: { tenantId: true }
              }
            }
          }
        }
      }
    }
  });
  
  if (!improvementOpportunity) {
    console.error(`❌ [PREVENTIVE_ACTION] Improvement opportunity not found: ${id}`);
    throw new AppError('Improvement opportunity not found', 404);
  }
  
  const finding = improvementOpportunity.finding;
  if (!finding) {
    console.error(`❌ [PREVENTIVE_ACTION] Finding not found for improvement opportunity: ${id}`);
    throw new AppError('Finding not found', 404);
  }

  console.log(`✅ [PREVENTIVE_ACTION] Found improvement opportunity data:`, {
    improvementOpportunityId: id,
    findingId: finding.id,
    department: finding.department,
    tenantId: finding.audit?.auditProgram?.tenantId
  });

  // 2. Update the observation requirement field with auditor information
  const auditorUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true }
  });
  
  if (!auditorUser) {
    console.error(`❌ [PREVENTIVE_ACTION] Auditor user not found: ${userId}`);
    throw new AppError('Auditor user not found', 404);
  }
  
  console.log(`✅ [PREVENTIVE_ACTION] Found auditor: ${auditorUser.firstName} ${auditorUser.lastName} (${auditorUser.email})`);
  
  const observationRequirementData = {
    area,
    observation,
    evidence,
    auditor: auditorUser ? `${auditorUser.firstName} ${auditorUser.lastName}` : 'Unknown Auditor',
    committedAt: new Date().toISOString(),
    committedBy: userId
  };
  
  console.log(`📝 [PREVENTIVE_ACTION] Updating observation requirement with data:`, {
    area: observationRequirementData.area,
    observation: observationRequirementData.observation,
    evidence: observationRequirementData.evidence,
    auditor: observationRequirementData.auditor,
    committedAt: observationRequirementData.committedAt
  });
  
  const updated = await prisma.improvementOpportunity.update({
    where: { id },
    data: { observationRequirement: observationRequirementData },
    include: {
      finding: true,
    },
  });

  console.log(`✅ [PREVENTIVE_ACTION] Successfully updated observation requirement`);

  // 3. Find the HOD for the department
  // Edge case: finding.department may be missing or not found in DB
  if (!finding.department) {
    console.warn(`⚠️ [PREVENTIVE_ACTION] No department info found for finding: ${finding.id}. Skipping HOD notification.`);
    return {
      success: true,
      notificationResults: [],
      hasSuccessfulNotifications: false
    };
  }
  
  console.log(`🔍 [PREVENTIVE_ACTION] Looking for HOD for department: "${finding.department}" in tenant: ${finding.audit?.auditProgram?.tenantId}`);
  
  // If in future, finding.department is an array, handle all
  const departmentNames = Array.isArray(finding.department) ? finding.department : [finding.department];
  let notificationResults = [];
  
  for (const departmentName of departmentNames) {
    if (!departmentName) {
      console.warn(`⚠️ [PREVENTIVE_ACTION] Empty department name found, skipping`);
      continue;
    }
    
    console.log(`🔍 [PREVENTIVE_ACTION] Processing department: "${departmentName}"`);
    
    const department = await prisma.department.findFirst({ 
      where: { 
        name: departmentName,
        tenantId: finding.audit?.auditProgram?.tenantId 
      },
      include: {
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });
    
    if (!department) {
      console.error(`❌ [PREVENTIVE_ACTION] Department not found: "${departmentName}" in tenant: ${finding.audit?.auditProgram?.tenantId}`);
      notificationResults.push({
        department: departmentName,
        status: 'FAILED',
        reason: 'Department not found in database',
        hodId: null
      });
      continue;
    }
    
    if (!department.hodId) {
      console.warn(`⚠️ [PREVENTIVE_ACTION] No HOD assigned to department: "${departmentName}"`);
      notificationResults.push({
        department: departmentName,
        status: 'FAILED',
        reason: 'No HOD assigned to department',
        hodId: null
      });
      continue;
    }
    
    console.log(`✅ [PREVENTIVE_ACTION] Found HOD for department "${departmentName}":`, {
      hodId: department.hodId,
      hodName: `${department.hod.firstName} ${department.hod.lastName}`,
      hodEmail: department.hod.email
    });
    
    // 4. Notify the HOD
    try {
      console.log(`📬 [PREVENTIVE_ACTION] Creating notification for HOD: ${department.hodId}`);
      
      const notification = await notificationRepository.createNotification({
        type: 'PREVENTIVE_ACTION_OBSERVATION_COMMITTED',
        title: `Observation Requirement Committed for ${departmentName}`,
        message: `An observation requirement has been committed for an improvement opportunity in your department. Please provide a potential root cause analysis and preventive action.`,
        tenantId: finding.audit?.auditProgram?.tenantId,
        targetUserId: department.hodId,
        link: `/auditors/preventive-actions/${id}`,
        metadata: { 
          improvementOpportunityId: id, 
          department: departmentName, 
          committedBy: userId 
        },
      });
      
      console.log(`✅ [PREVENTIVE_ACTION] Successfully created notification:`, {
        notificationId: notification.id,
        type: notification.type,
        targetUserId: notification.targetUserId,
        link: notification.link
      });
      
      // Emit real-time notification to HOD
      try {
        console.log(`🔌 [PREVENTIVE_ACTION] Attempting to send real-time notification to HOD: ${department.hodId}`);
        
        const socketService = require('./socketService');
        const io = socketService.getIO();
        
        if (!io) {
          console.warn(`⚠️ [PREVENTIVE_ACTION] Socket.io not initialized, skipping real-time notification`);
          notificationResults.push({
            department: departmentName,
            status: 'PARTIAL_SUCCESS',
            reason: 'Database notification created, but socket.io not available',
            hodId: department.hodId,
            notificationId: notification.id,
            socketError: 'Socket.io not initialized'
          });
          continue;
        }
        
        io.to(`user:${department.hodId}`).emit('notificationCreated', {
          ...notification,
          userId: department.hodId
        });
        
        console.log(`✅ [PREVENTIVE_ACTION] Successfully sent real-time notification to HOD: ${department.hodId}`);
        
        notificationResults.push({
          department: departmentName,
          status: 'SUCCESS',
          hodId: department.hodId,
          notificationId: notification.id,
          hodName: `${department.hod.firstName} ${department.hod.lastName}`,
          hodEmail: department.hod.email
        });
        
      } catch (socketErr) {
        console.error(`❌ [PREVENTIVE_ACTION] Failed to emit real-time notification to HOD: ${department.hodId}`, {
          error: socketErr.message,
          stack: socketErr.stack,
          hodId: department.hodId,
          department: departmentName
        });
        
        notificationResults.push({
          department: departmentName,
          status: 'PARTIAL_SUCCESS',
          reason: 'Database notification created, but real-time notification failed',
          hodId: department.hodId,
          notificationId: notification.id,
          socketError: socketErr.message
        });
      }
      
    } catch (notificationErr) {
      console.error(`❌ [PREVENTIVE_ACTION] Failed to create notification for HOD: ${department.hodId}`, {
        error: notificationErr.message,
        stack: notificationErr.stack,
        hodId: department.hodId,
        department: departmentName,
        tenantId: finding.audit?.auditProgram?.tenantId
      });
      
      notificationResults.push({
        department: departmentName,
        status: 'FAILED',
        reason: 'Failed to create notification',
        hodId: department.hodId,
        error: notificationErr.message
      });
    }
  }
  
  // Log comprehensive notification summary
  console.log(`📊 [PREVENTIVE_ACTION] Notification Summary for improvement opportunity: ${id}:`, {
    totalDepartments: departmentNames.length,
    successfulNotifications: notificationResults.filter(r => r.status === 'SUCCESS').length,
    partialSuccess: notificationResults.filter(r => r.status === 'PARTIAL_SUCCESS').length,
    failedNotifications: notificationResults.filter(r => r.status === 'FAILED').length,
    results: notificationResults
  });
  
  // Check if any notifications were successful
  const hasSuccessfulNotifications = notificationResults.some(r => r.status === 'SUCCESS' || r.status === 'PARTIAL_SUCCESS');
  
  if (!hasSuccessfulNotifications) {
    console.error(`🚨 [PREVENTIVE_ACTION] CRITICAL: No HOD notifications were successful for improvement opportunity: ${id}`, {
      improvementOpportunityId: id,
      findingId: finding.id,
      department: finding.department,
      notificationResults
    });
  } else {
    console.log(`✅ [PREVENTIVE_ACTION] Observation requirement committed successfully with HOD notifications sent`);
  }
  
  return {
    success: true,
    preventiveAction: updated,
    notificationResults,
    hasSuccessfulNotifications
  };
}

async function getPreventiveActionById(id) {
  return prisma.improvementOpportunity.findUnique({
    where: { id },
    include: {
      finding: true,
      createdBy: true,
      owner: true,
    },
  });
}

async function listImprovementOpportunities() {
  return prisma.improvementOpportunity.findMany({
    include: {
      finding: {
        include: {
          audit: {
            include: {
              auditProgram: true
            }
          }
        }
      },
      createdBy: true,
      owner: true,
    },
    orderBy: { createdAt: 'desc' }
  });
}

async function saveProposedPreventiveAction({ id, rootCause, preventiveAction, completionDate, auditee, prevention }) {
  console.log(`🔍 [PREVENTIVE_ACTION] Starting proposed action save for ID: ${id}`);
  
  // Save the proposed action
  const updated = await prisma.improvementOpportunity.update({
    where: { id },
    data: {
      proposedAction: {
        rootCause,
        preventiveAction,
        completionDate,
        auditee,
        prevention,
      },
    },
    include: {
      createdBy: true,
      finding: {
        include: {
          audit: {
            include: {
              auditProgram: {
                select: { tenantId: true }
              }
            }
          }
        }
      }
    },
  });

  console.log(`✅ [PREVENTIVE_ACTION] Successfully saved proposed action for improvement opportunity: ${id}`);

  // Notify the auditor who created the improvement opportunity
  if (updated.createdById) {
    console.log(`📬 [PREVENTIVE_ACTION] Creating notification for auditor: ${updated.createdById}`);
    
    try {
      const notification = await notificationRepository.createNotification({
        type: 'PREVENTIVE_ROOT_CAUSE_SUBMITTED',
        title: 'Root Cause Analysis Submitted',
        message: `The HOD has submitted a root cause analysis for preventive action: ${updated.opportunity}.`,
        tenantId: updated.finding?.audit?.auditProgram?.tenantId || updated.createdBy.tenantId,
        targetUserId: updated.createdById,
        link: `/auditors/preventive-actions/${updated.id}`,
        metadata: { improvementOpportunityId: updated.id },
      });
      
      console.log(`✅ [PREVENTIVE_ACTION] Successfully created notification for auditor: ${updated.createdById}`);
      
      // Emit real-time notification to the auditor
      try {
        const socketService = require('./socketService');
        const io = socketService.getIO();
        
        if (io) {
          io.to(`user:${updated.createdById}`).emit('notificationCreated', {
            ...notification,
            userId: updated.createdById,
          });
          console.log(`✅ [PREVENTIVE_ACTION] Successfully sent real-time notification to auditor: ${updated.createdById}`);
        } else {
          console.warn(`⚠️ [PREVENTIVE_ACTION] Socket.io not initialized, skipping real-time notification to auditor`);
        }
      } catch (err) {
        console.error(`❌ [PREVENTIVE_ACTION] Failed to emit real-time notification to auditor: ${updated.createdById}`, {
          error: err.message,
          stack: err.stack
        });
      }
    } catch (notificationErr) {
      console.error(`❌ [PREVENTIVE_ACTION] Failed to create notification for auditor: ${updated.createdById}`, {
        error: notificationErr.message,
        stack: notificationErr.stack
      });
    }
  } else {
    console.warn(`⚠️ [PREVENTIVE_ACTION] No createdById found for improvement opportunity: ${id}`);
  }
  
  return updated;
}

async function submitAppropriatenessReview({ id, response, comment, auditorId }) {
  const appropriatenessReview = {
    auditorId,
    response,
    comment: response === 'NO' ? comment : undefined,
    respondedAt: new Date().toISOString(),
  };
  return prisma.improvementOpportunity.update({
    where: { id },
    data: { appropriatenessReview },
  });
}

async function submitFollowUpAction({ id, status, auditorId }) {
  const followUpAction = {
    action: status,
    status: status === 'ACTION_FULLY_COMPLETED' ? 'CLOSED' : 'OPEN',
    updatedBy: auditorId,
    updatedAt: new Date().toISOString(),
  };
  return prisma.improvementOpportunity.update({
    where: { id },
    data: { followUpAction },
  });
}

async function submitActionEffectiveness({ id, response, details, auditorId }) {
  const actionEffectiveness = {
    response,
    details,
    status: response === 'YES' ? 'CLOSED' : 'OPEN',
    auditorId,
    reviewedAt: new Date().toISOString(),
  };
  return prisma.improvementOpportunity.update({
    where: { id },
    data: { actionEffectiveness },
  });
}

async function notifyMR({ preventiveActionId, comment, senderId }) {
  // Fetch the preventive action and all related data
  const preventiveAction = await prisma.improvementOpportunity.findUnique({
    where: { id: preventiveActionId },
    include: {
      finding: {
        include: {
          audit: {
            include: { auditProgram: true }
          }
        }
      },
      createdBy: true,
      owner: true,
    },
  });
  if (!preventiveAction) throw new Error('Preventive action not found');
  const tenantId = preventiveAction.finding?.audit?.auditProgram?.tenantId;
  // Find MR role first
  const mrRole = await prisma.role.findFirst({
    where: { 
      name: 'MR',
      tenantId 
    }
  });
  
  if (!mrRole) {
    throw new Error('MR role not found for this tenant');
  }
  
  // Find MR user (either global or department-specific)
  const mrUser = await prisma.user.findFirst({
    where: {
      tenantId,
      OR: [
        { userRoles: { some: { roleId: mrRole.id } } },
        { userDepartmentRoles: { some: { roleId: mrRole.id } } }
      ]
    }
  });
  if (!mrUser) throw new Error('MR not found for this tenant');
  // Compose message
  const program = preventiveAction.finding?.audit?.auditProgram?.title || '-';
  const auditType = preventiveAction.finding?.audit?.type || '-';
  const department = preventiveAction.finding?.department || '-';
  const or = preventiveAction.observationRequirement || {};
  const pa = preventiveAction.proposedAction || {};
  const fua = preventiveAction.followUpAction || {};
  const completionDate = pa.completionDate ? new Date(pa.completionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const statusText = fua.action ? (
    fua.action === 'ACTION_FULLY_COMPLETED' ? 'Action fully completed' :
    fua.action === 'ACTION_PARTIALLY_COMPLETED' ? 'Action partially completed' :
    fua.action === 'NO_ACTION_TAKEN' ? 'No action taken' : fua.action
  ) : '-';
  const preventiveActionLink = `/auditors/preventive-actions/${preventiveActionId}`;
  const messageBody = `A follow up action to the following programme has been made.\n\n` +
    `| PROGRAMME | AUDIT NUMBER | DEPARTMENT |\n` +
    `|-----------|--------------|------------|\n` +
    `| ${program} | ${auditType} | ${department} |\n\n` +
    `| AREA UNDER REVIEW | REQUIREMENT | EVIDENCE |\n` +
    `|-------------------|-------------|----------|\n` +
    `| ${or.area || '-'} | ${or.observation || '-'} | ${or.evidence || '-'} |\n\n` +
    `| Root Cause | Correction (as applicable) | Corrective action to be taken to prevent recurrence | Completion Date |\n` +
    `|------------|---------------------------|-----------------------------------------------------|-----------------|\n` +
    `| ${pa.rootCause || '-'} | ${pa.prevention || '-'} | ${pa.preventiveAction || '-'} | ${completionDate} |\n\n` +
    `| Status | Comment |\n` +
    `|--------|---------|\n` +
    `| ${statusText} | ${comment || '-'} |\n\n` +
    `[View Preventive Action](${preventiveActionLink})\n`;
  // Send message
  await messageService.sendMessage({
    senderId,
    recipientId: mrUser.id,
    tenantId,
    subject: 'Preventive Action Follow Up',
    body: messageBody,
    files: []
  });
  // Mark as notified
  await prisma.improvementOpportunity.update({
    where: { id: preventiveActionId },
    data: { mrNotified: true }
  });
}

module.exports = {
  updateObservationRequirement,
  getPreventiveActionById,
  listImprovementOpportunities,
  saveProposedPreventiveAction,
  submitAppropriatenessReview,
  submitFollowUpAction,
  submitActionEffectiveness,
  notifyMR,
}; 