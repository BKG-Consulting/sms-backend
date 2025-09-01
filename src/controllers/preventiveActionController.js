const preventiveActionService = require('../services/preventiveActionService');
const { prisma } = require('../../prisma/client');

// Save or update the observation requirement for a preventive action
async function commitObservationRequirement(req, res, next) {
  try {
    const { id } = req.params;
    const { area, observation, evidence } = req.body;
    const userId = req.user.userId; // Use userId as set by auth middleware
    
    console.log(`🔍 [CONTROLLER] commitObservationRequirement called for ID: ${id} by user: ${userId}`);
    
    let auditor = '';
    if (req.user.firstName && req.user.lastName) {
      auditor = req.user.firstName + ' ' + req.user.lastName;
    } else {
      // Fallback: fetch from DB
      const user = await prisma.user.findUnique({ where: { id: userId } });
      auditor = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : (req.user.email || '');
    }
    
    const result = await preventiveActionService.updateObservationRequirement({ 
      id, 
      area, 
      observation, 
      evidence, 
      auditor, 
      userId 
    });
    
    // Prepare response based on notification results
    const successfulNotifications = result.notificationResults.filter(r => r.status === 'SUCCESS').length;
    const partialSuccess = result.notificationResults.filter(r => r.status === 'PARTIAL_SUCCESS').length;
    const failedNotifications = result.notificationResults.filter(r => r.status === 'FAILED').length;
    
    let message = 'Observation requirement committed successfully.';
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
      message = 'Observation requirement committed, but HOD notification failed. Please check department configuration.';
      status = 207; // Multi-Status
    }
    
    console.log(`✅ [CONTROLLER] commitObservationRequirement completed with status: ${status}`, {
      improvementOpportunityId: id,
      successfulNotifications,
      partialSuccess,
      failedNotifications,
      hasSuccessfulNotifications: result.hasSuccessfulNotifications
    });
    
    res.status(status).json({ 
      success: true, 
      message,
      preventiveAction: result.preventiveAction,
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
    console.error(`❌ [CONTROLLER] commitObservationRequirement failed:`, {
      error: err.message,
      stack: err.stack,
      improvementOpportunityId: req.params.id,
      userId: req.user.userId
    });
    next(err);
  }
}

// Fetch the full preventive action (ImprovementOpportunity + related finding)
async function getPreventiveActionById(req, res, next) {
  try {
    const { id } = req.params;
    const preventiveAction = await preventiveActionService.getPreventiveActionById(id);
    if (!preventiveAction) {
      return res.status(404).json({ success: false, message: 'Preventive action not found' });
    }
    res.status(200).json({ success: true, preventiveAction });
  } catch (err) {
    next(err);
  }
}

// List all improvement opportunities (for table display)
async function listImprovementOpportunities(req, res, next) {
  try {
    const opportunities = await preventiveActionService.listImprovementOpportunities();
    res.status(200).json({ success: true, opportunities });
  } catch (err) {
    next(err);
  }
}

// Save the proposed preventive action (potential root cause analysis)
async function commitProposedPreventiveAction(req, res, next) {
  try {
    const { id } = req.params;
    const { rootCause, preventiveAction, completionDate } = req.body;
    // Find the HOD for the department (auditee)
    const preventive = await prisma.improvementOpportunity.findUnique({
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
      },
    });
    let auditee = null;
    if (preventive?.finding?.department) {
      const tenantId = preventive.finding.audit?.auditProgram?.tenantId;
      const dept = await prisma.department.findFirst({ 
        where: { 
          name: preventive.finding.department,
          tenantId: tenantId
        }
      });
      if (dept?.hodId) {
        const hod = await prisma.user.findUnique({ where: { id: dept.hodId } });
        auditee = hod ? `${hod.firstName || ''} ${hod.lastName || ''}`.trim() : null;
      }
    }
    const updated = await preventiveActionService.saveProposedPreventiveAction({ id, rootCause, preventiveAction, completionDate, auditee });
    res.status(200).json({ success: true, preventiveAction: updated });
  } catch (err) {
    next(err);
  }
}

// Appropriateness Review
async function submitAppropriatenessReview(req, res, next) {
  try {
    const { id } = req.params;
    const { response, comment } = req.body;
    const auditorId = req.user.id || req.user.userId;
    if (!auditorId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    if (!['YES', 'NO'].includes(response)) return res.status(400).json({ success: false, message: 'Response must be YES or NO' });
    if (response === 'NO' && (!comment || comment.trim() === '')) return res.status(400).json({ success: false, message: 'Comment is required when response is NO' });
    const updated = await preventiveActionService.submitAppropriatenessReview({ id, response, comment, auditorId });
    res.status(200).json({ success: true, preventiveAction: updated });
  } catch (err) {
    next(err);
  }
}

// Follow Up Action
async function submitFollowUpAction(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const auditorId = req.user.id || req.user.userId;
    if (!auditorId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    if (!['ACTION_FULLY_COMPLETED', 'ACTION_PARTIALLY_COMPLETED', 'NO_ACTION_TAKEN'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid follow up action status' });
    }
    const updated = await preventiveActionService.submitFollowUpAction({ id, status, auditorId });
    res.status(200).json({ success: true, preventiveAction: updated });
  } catch (err) {
    next(err);
  }
}

// Action Effectiveness
async function submitActionEffectiveness(req, res, next) {
  try {
    const { id } = req.params;
    const { response, details } = req.body;
    const auditorId = req.user.id || req.user.userId;
    if (!auditorId) return res.status(401).json({ success: false, message: 'User not authenticated' });
    if (!['YES', 'NO'].includes(response)) return res.status(400).json({ success: false, message: 'Response must be YES or NO' });
    if (!details) return res.status(400).json({ success: false, message: 'Details are required' });
    const updated = await preventiveActionService.submitActionEffectiveness({ id, response, details, auditorId });
    res.status(200).json({ success: true, preventiveAction: updated });
  } catch (err) {
    next(err);
  }
}

// Notify Management Representative (MR)
async function notifyMR(req, res, next) {
  try {
    const preventiveActionId = req.params.id;
    const { comment } = req.body;
    const senderId = req.user.id || req.user.userId;
    await preventiveActionService.notifyMR({ preventiveActionId, comment, senderId });
    res.status(200).json({ success: true, message: 'Message sent to MR.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  commitObservationRequirement,
  getPreventiveActionById,
  listImprovementOpportunities,
  commitProposedPreventiveAction,
  submitAppropriatenessReview,
  submitFollowUpAction,
  submitActionEffectiveness,
  notifyMR,
}; 