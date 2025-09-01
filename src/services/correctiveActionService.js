const { prisma } = require('../../prisma/client');
const { AppError } = require('../../errors/app.error');
const notificationRepository = require('../repositories/notification.repository');
const userRepository = require('../repositories/userRepository');
const departmentRepository = require('../repositories/departmentRepository');
const correctiveActionRepository = require('../repositories/correctiveActionRepository');

async function commitCorrectionRequirement({ correctiveActionId, data, userId }) {
  console.log(`🔍 [CORRECTIVE_ACTION] Starting correction requirement commit for ID: ${correctiveActionId} by user: ${userId}`);
  
  // 1. Fetch the corrective action and related non-conformity
  const correctiveAction = await prisma.correctiveAction.findUnique({
    where: { id: correctiveActionId },
    include: {
      nonConformity: {
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
      }
    }
  });
  
  if (!correctiveAction) {
    console.error(`❌ [CORRECTIVE_ACTION] Corrective action not found: ${correctiveActionId}`);
    throw new AppError('Corrective action not found', 404);
  }
  
  if (!correctiveAction.nonConformity) {
    console.error(`❌ [CORRECTIVE_ACTION] Non-conformity not found for corrective action: ${correctiveActionId}`);
    throw new AppError('Non-conformity not found', 404);
  }
  
  const finding = correctiveAction.nonConformity.finding;
  if (!finding) {
    console.error(`❌ [CORRECTIVE_ACTION] Finding not found for non-conformity: ${correctiveAction.nonConformity.id}`);
    throw new AppError('Finding not found', 404);
  }

  console.log(`✅ [CORRECTIVE_ACTION] Found corrective action data:`, {
    correctiveActionId,
    nonConformityId: correctiveAction.nonConformityId,
    findingId: finding.id,
    department: finding.department,
    tenantId: finding.audit?.auditProgram?.tenantId
  });

  // 2. Validate user is allowed (e.g., is the auditor who created the finding or assigned to the action)
  // Allow any authenticated auditor to commit (no team membership check)

  // 3. Update the correctionRequirement field with auditor information
  const auditor = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true }
  });
  
  if (!auditor) {
    console.error(`❌ [CORRECTIVE_ACTION] Auditor user not found: ${userId}`);
    throw new AppError('Auditor user not found', 404);
  }
  
  console.log(`✅ [CORRECTIVE_ACTION] Found auditor: ${auditor.firstName} ${auditor.lastName} (${auditor.email})`);
  
  const correctionRequirementData = {
    ...data,
    auditor: auditor ? `${auditor.firstName} ${auditor.lastName}` : 'Unknown Auditor',
    committedAt: new Date().toISOString(),
    committedBy: userId
  };
  
  console.log(`📝 [CORRECTIVE_ACTION] Updating correction requirement with data:`, {
    area: data.area,
    requirement: data.requirement,
    category: data.category,
    auditor: correctionRequirementData.auditor,
    committedAt: correctionRequirementData.committedAt
  });
  
  await correctiveActionRepository.updateCorrectionRequirement(correctiveActionId, correctionRequirementData);
  await prisma.correctiveAction.update({
    where: { id: correctiveActionId },
    data: { status: 'IN_PROGRESS' }
  });

  console.log(`✅ [CORRECTIVE_ACTION] Successfully updated corrective action status to IN_PROGRESS`);

  // 4. Find the HOD for the department
  // Edge case: finding.department may be missing or not found in DB
  if (!finding.department) {
    console.warn(`⚠️ [CORRECTIVE_ACTION] No department info found for finding: ${finding.id}. Skipping HOD notification.`);
    return;
  }
  
  console.log(`🔍 [CORRECTIVE_ACTION] Looking for HOD for department: "${finding.department}" in tenant: ${finding.audit?.auditProgram?.tenantId}`);
  
  // If in future, finding.department is an array, handle all
  const departmentNames = Array.isArray(finding.department) ? finding.department : [finding.department];
  let notificationResults = [];
  
  for (const departmentName of departmentNames) {
    if (!departmentName) {
      console.warn(`⚠️ [CORRECTIVE_ACTION] Empty department name found, skipping`);
      continue;
    }
    
    console.log(`🔍 [CORRECTIVE_ACTION] Processing department: "${departmentName}"`);
    
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
      console.error(`❌ [CORRECTIVE_ACTION] Department not found: "${departmentName}" in tenant: ${finding.audit?.auditProgram?.tenantId}`);
      notificationResults.push({
        department: departmentName,
        status: 'FAILED',
        reason: 'Department not found in database',
        hodId: null
      });
      continue;
    }
    
    if (!department.hodId) {
      console.warn(`⚠️ [CORRECTIVE_ACTION] No HOD assigned to department: "${departmentName}"`);
      notificationResults.push({
        department: departmentName,
        status: 'FAILED',
        reason: 'No HOD assigned to department',
        hodId: null
      });
      continue;
    }
    
    console.log(`✅ [CORRECTIVE_ACTION] Found HOD for department "${departmentName}":`, {
      hodId: department.hodId,
      hodName: `${department.hod.firstName} ${department.hod.lastName}`,
      hodEmail: department.hod.email
    });
    
    // 5. Notify the HOD
    try {
      console.log(`📬 [CORRECTIVE_ACTION] Creating notification for HOD: ${department.hodId}`);
      
      const notification = await notificationRepository.createNotification({
        type: 'CORRECTIVE_ACTION_COMMITTED',
        title: `Correction Requirement Committed for ${departmentName}`,
        message: `A correction requirement has been committed for a non-conformity in your department. Please provide a proposed action and root cause analysis.`,
        tenantId: finding.audit?.auditProgram?.tenantId,
        targetUserId: department.hodId,
        link: `/auditors/corrective-actions/${correctiveAction.nonConformityId}`, // Use nonConformityId instead of correctiveActionId
        metadata: { 
          correctiveActionId, 
          nonConformityId: correctiveAction.nonConformityId, // Include both for reference
          department: departmentName, 
          committedBy: userId 
        },
      });
      
      console.log(`✅ [CORRECTIVE_ACTION] Successfully created notification:`, {
        notificationId: notification.id,
        type: notification.type,
        targetUserId: notification.targetUserId,
        link: notification.link
      });
      
      // Emit real-time notification to HOD
      try {
        console.log(`🔌 [CORRECTIVE_ACTION] Attempting to send real-time notification to HOD: ${department.hodId}`);
        
        const socketService = require('./socketService');
        const io = socketService.getIO();
        
        if (!io) {
          console.warn(`⚠️ [CORRECTIVE_ACTION] Socket.io not initialized, skipping real-time notification`);
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
        
        console.log(`✅ [CORRECTIVE_ACTION] Successfully sent real-time notification to HOD: ${department.hodId}`);
        
        notificationResults.push({
          department: departmentName,
          status: 'SUCCESS',
          hodId: department.hodId,
          notificationId: notification.id,
          hodName: `${department.hod.firstName} ${department.hod.lastName}`,
          hodEmail: department.hod.email
        });
        
      } catch (socketErr) {
        console.error(`❌ [CORRECTIVE_ACTION] Failed to emit real-time notification to HOD: ${department.hodId}`, {
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
      console.error(`❌ [CORRECTIVE_ACTION] Failed to create notification for HOD: ${department.hodId}`, {
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
  console.log(`📊 [CORRECTIVE_ACTION] Notification Summary for corrective action: ${correctiveActionId}:`, {
    totalDepartments: departmentNames.length,
    successfulNotifications: notificationResults.filter(r => r.status === 'SUCCESS').length,
    partialSuccess: notificationResults.filter(r => r.status === 'PARTIAL_SUCCESS').length,
    failedNotifications: notificationResults.filter(r => r.status === 'FAILED').length,
    results: notificationResults
  });
  
  // Check if any notifications were successful
  const hasSuccessfulNotifications = notificationResults.some(r => r.status === 'SUCCESS' || r.status === 'PARTIAL_SUCCESS');
  
  if (!hasSuccessfulNotifications) {
    console.error(`🚨 [CORRECTIVE_ACTION] CRITICAL: No HOD notifications were successful for corrective action: ${correctiveActionId}`, {
      correctiveActionId,
      findingId: finding.id,
      department: finding.department,
      notificationResults
    });
  } else {
    console.log(`✅ [CORRECTIVE_ACTION] Correction requirement committed successfully with HOD notifications sent`);
  }
  
  return {
    success: true,
    notificationResults,
    hasSuccessfulNotifications
  };
}

module.exports = {
  commitCorrectionRequirement,
}; 