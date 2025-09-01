/**
 * Audit Analysis Service
 * Handles comprehensive audit analysis operations with proper error handling,
 * validation, and separation of concerns.
 */

const auditAnalysisRepository = require('../repositories/auditAnalysisRepository');
const messageService = require('./messageService');
const notificationService = require('./notificationService');
const { prisma } = require('../../prisma/client');

// Constants
const WORKFLOW_COMPLETION_THRESHOLD = 80; // Percentage required for analysis
const FINDING_CATEGORIES = {
  COMPLIANCE: 'COMPLIANCE',
  IMPROVEMENT: 'IMPROVEMENT', 
  NON_CONFORMITY: 'NON_CONFORMITY'
};

/**
 * Custom error classes for better error handling
 */
class AuditAnalysisError extends Error {
  constructor(message, code = 'AUDIT_ANALYSIS_ERROR') {
    super(message);
    this.name = 'AuditAnalysisError';
    this.code = code;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
  }
}

/**
 * Input validation utilities
 */
const validateRequired = (value, fieldName) => {
  if (!value) {
    throw new ValidationError(`${fieldName} is required`);
  }
};

const validateAuditId = (auditId) => {
  validateRequired(auditId, 'auditId');
  if (typeof auditId !== 'string' && typeof auditId !== 'number') {
    throw new ValidationError('auditId must be a string or number');
  }
};

/**
 * Legacy audit analysis methods (maintained for backward compatibility)
 */

/**
 * Save audit analysis with proper validation and error handling
 * @param {Object} analysisData - Analysis data to save
 * @param {string} analysisData.auditId - Audit identifier
 * @param {string} analysisData.department - Department name
 * @param {string} analysisData.submittedById - User ID who submitted
 * @param {Array} analysisData.metrics - Analysis metrics
 * @param {string} analysisData.remarks - Analysis remarks
 * @param {boolean} analysisData.finished - Whether analysis is finished
 * @returns {Promise<Object>} Saved analysis
 */
async function saveAuditAnalysis({ auditId, department, submittedById, metrics, remarks, finished }) {
  try {
    // Validate inputs
    validateAuditId(auditId);
    validateRequired(submittedById, 'submittedById');
    
    if (metrics && !Array.isArray(metrics)) {
      throw new ValidationError('metrics must be an array');
    }

    // Save analysis through repository
    const analysis = await auditAnalysisRepository.upsertAuditAnalysis({
      auditId,
      department,
      submittedById,
      metrics,
      remarks,
      finished,
    });

    // Handle MR notification if finished
    if (finished && !analysis.mrNotified) {
      await notifyMR({ analysis });
    }

    return analysis;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AuditAnalysisError(`Failed to save audit analysis: ${error.message}`);
  }
}

/**
 * Get audit analysis with validation
 * @param {string} auditId - Audit identifier
 * @param {string} department - Department name
 * @returns {Promise<Object|null>} Analysis data or null if not found
 */
async function getAuditAnalysis(auditId, department) {
  try {
    validateAuditId(auditId);
    return await auditAnalysisRepository.getAuditAnalysis(auditId, department);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AuditAnalysisError(`Failed to get audit analysis: ${error.message}`);
  }
}

/**
 * Comprehensive Analysis Methods
 */

/**
 * Get comprehensive analysis - either existing or generate new
 * @param {string} auditId - Audit identifier
 * @param {string} [departmentId] - Optional department identifier
 * @returns {Promise<Object>} Comprehensive analysis data
 */
async function getComprehensiveAnalysis(auditId, departmentId = null) {
  try {
    validateAuditId(auditId);

    // Handle URL decoding for departmentId
    let decodedDepartmentId = departmentId;
    if (departmentId) {
      try {
        decodedDepartmentId = decodeURIComponent(departmentId);
        if (decodedDepartmentId.includes('%')) {
          decodedDepartmentId = decodeURIComponent(decodedDepartmentId);
        }
      } catch (error) {
        console.error('Error decoding departmentId:', error);
        decodedDepartmentId = departmentId;
      }
    }

    // Try to get existing saved analysis first
    const existingAnalysis = await auditAnalysisRepository.getComprehensiveAnalysis(auditId, decodedDepartmentId);
    if (existingAnalysis) {
      return existingAnalysis;
    }

    // Generate new analysis if none exists
    return await generateComprehensiveAnalysis(auditId, decodedDepartmentId);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AuditAnalysisError(`Failed to get comprehensive analysis: ${error.message}`);
  }
}

/**
 * Generate comprehensive analysis from findings
 * @param {string} auditId - Audit identifier
 * @param {string} [departmentId] - Optional department identifier
 * @returns {Promise<Object>} Generated analysis data
 */
async function generateComprehensiveAnalysis(auditId, departmentId = null) {
  try {
    validateAuditId(auditId);

    // Handle URL decoding for departmentId
    let decodedDepartmentId = departmentId;
    if (departmentId) {
      try {
        decodedDepartmentId = decodeURIComponent(departmentId);
        if (decodedDepartmentId.includes('%')) {
          decodedDepartmentId = decodeURIComponent(decodedDepartmentId);
        }
      } catch (error) {
        console.error('Error decoding departmentId:', error);
        decodedDepartmentId = departmentId;
      }
    }

    // Get detailed findings
    const findings = await getDetailedFindings(auditId, decodedDepartmentId);
    
    // Process findings by category
    const analysisData = processFindings(findings);
    
    // Calculate workflow completion metrics
    const workflowMetrics = calculateWorkflowMetrics(findings);
    
    // Get audit metadata
    const auditMetadata = await getAuditMetadata(auditId, decodedDepartmentId);

    return {
      auditId,
      auditTitle: auditMetadata.auditTitle,
      auditType: auditMetadata.auditType,
      departmentId: decodedDepartmentId,
      departmentName: auditMetadata.departmentName,
      analysisData,
      totalFindings: findings.length,
      completionPercentage: workflowMetrics.completionPercentage,
      generatedAt: new Date().toISOString(),
      analyzedBy: 'System Generated',
      isCompleted: false,
      remarks: ''
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AuditAnalysisError(`Failed to generate comprehensive analysis: ${error.message}`);
  }
}

/**
 * Save comprehensive analysis with validation and notifications
 * @param {Object} analysisData - Analysis data to save
 * @returns {Promise<Object>} Saved analysis
 */
async function saveComprehensiveAnalysis(analysisData) {
  try {
    // Validate required fields
    validateRequired(analysisData, 'analysisData');
    validateAuditId(analysisData.auditId);
    
    if (analysisData.teamLeaderId) {
      validateRequired(analysisData.teamLeaderId, 'teamLeaderId');
    }

    // Save analysis
    const savedAnalysis = await auditAnalysisRepository.saveComprehensiveAnalysis(analysisData);

    // Send notifications (non-blocking)
    try {
      await sendAnalysisCompletionNotification(analysisData);
    } catch (notificationError) {
      console.error('Failed to send notifications:', notificationError);
      // Don't fail the save operation if notification fails
    }

    return savedAnalysis;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AuditAnalysisError(`Failed to save comprehensive analysis: ${error.message}`);
  }
}

/**
 * Get detailed findings for analysis using actual database schema
 * @param {string} auditId - Audit identifier
 * @param {string} [departmentId] - Optional department identifier
 * @returns {Promise<Array>} Array of detailed findings
 */
async function getDetailedFindings(auditId, departmentId = null) {
  try {
    validateAuditId(auditId);

    // Handle URL decoding - the departmentId might be double-encoded
    let decodedDepartmentId = departmentId;
    if (departmentId) {
      try {
        // First decode - handles single encoding
        decodedDepartmentId = decodeURIComponent(departmentId);
        // Second decode - handles double encoding (like %2520 -> %20 -> space)
        if (decodedDepartmentId.includes('%')) {
          decodedDepartmentId = decodeURIComponent(decodedDepartmentId);
        }
      } catch (error) {
        console.error('Error decoding departmentId:', error);
        // If decoding fails, use original value
        decodedDepartmentId = departmentId;
      }
    }

    const whereClause = {
      auditId: auditId,
      ...(decodedDepartmentId && { department: decodedDepartmentId })
    };

    // Query actual AuditFinding model with related data
    const findings = await prisma.auditFinding.findMany({
      where: whereClause,
      include: {
        nonConformities: {
          include: {
            correctiveActions: true
          }
        },
        improvements: true,
        compliance: true
      }
    });

    // Transform to expected format
    return findings.map(finding => ({
      findingId: finding.id,
      description: finding.description,
      title: finding.title,
      category: finding.category,
      departmentId: finding.department,
      department: {
        departmentId: finding.department,
        name: finding.department // TODO: Join with actual department table
      },
      // Transform corrective actions from nonConformities
      correctiveActions: finding.nonConformities.flatMap(nc => 
        nc.correctiveActions.map(ca => ({
          actionId: ca.id,
          description: ca.description,
          status: ca.status,
          isCompleted: ca.status === 'CLOSED',
          workflow: { status: ca.status }
        }))
      ),
      // Transform preventive actions from improvements
      preventiveActions: finding.improvements ? [{
        actionId: finding.improvements.id,
        description: finding.improvements.opportunity,
        status: finding.improvements.status,
        isCompleted: finding.improvements.status === 'CLOSED',
        workflow: { status: finding.improvements.status }
      }] : []
    }));
  } catch (error) {
    console.error('Error fetching detailed findings:', error);
    throw new AuditAnalysisError(`Failed to get detailed findings: ${error.message}`);
  }
}

/**
 * Get analysis for public viewing
 * @param {string} auditId - Audit identifier
 * @param {string} [departmentId] - Optional department identifier
 * @returns {Promise<Object|null>} Analysis for viewing or null
 */
async function getAnalysisForViewing(auditId, departmentId = null) {
  try {
    validateAuditId(auditId);
    
    // Handle URL decoding for departmentId
    let decodedDepartmentId = departmentId;
    if (departmentId) {
      try {
        decodedDepartmentId = decodeURIComponent(departmentId);
        if (decodedDepartmentId.includes('%')) {
          decodedDepartmentId = decodeURIComponent(decodedDepartmentId);
        }
      } catch (error) {
        console.error('Error decoding departmentId:', error);
        decodedDepartmentId = departmentId;
      }
    }
    
    return await auditAnalysisRepository.getComprehensiveAnalysis(auditId, decodedDepartmentId);
  } catch (error) {
    throw new AuditAnalysisError(`Failed to get analysis for viewing: ${error.message}`);
  }
}

/**
 * Get workflow completion status
 * @param {string} auditId - Audit identifier
 * @param {string} [departmentId] - Optional department identifier
 * @returns {Promise<Object>} Workflow status information
 */
async function getWorkflowStatus(auditId, departmentId = null) {
  try {
    validateAuditId(auditId);
    
    // Handle URL decoding for departmentId
    let decodedDepartmentId = departmentId;
    if (departmentId) {
      try {
        decodedDepartmentId = decodeURIComponent(departmentId);
        if (decodedDepartmentId.includes('%')) {
          decodedDepartmentId = decodeURIComponent(decodedDepartmentId);
        }
      } catch (error) {
        console.error('Error decoding departmentId:', error);
        decodedDepartmentId = departmentId;
      }
    }
    
    const findings = await getDetailedFindings(auditId, decodedDepartmentId);
    const metrics = calculateWorkflowMetrics(findings);
    
    return {
      auditId,
      departmentId: decodedDepartmentId,
      isAnalysisAvailable: metrics.completionPercentage >= WORKFLOW_COMPLETION_THRESHOLD,
      workflowCompletion: {
        findingsCategorized: true,
        correctiveActionsCompleted: metrics.correctiveActionsCompleted,
        preventiveActionsCompleted: metrics.preventiveActionsCompleted,
        totalFindings: findings.length,
        categorizedFindings: findings.length,
        totalCorrectiveActions: metrics.totalCorrectiveActions,
        completedCorrectiveActions: metrics.completedCorrectiveActions,
        totalPreventiveActions: metrics.totalPreventiveActions,
        completedPreventiveActions: metrics.completedPreventiveActions,
        completionPercentage: metrics.completionPercentage
      },
      blockers: metrics.completionPercentage < WORKFLOW_COMPLETION_THRESHOLD 
        ? ['Workflow completion below required threshold']
        : [],
      readyForAnalysis: metrics.completionPercentage >= WORKFLOW_COMPLETION_THRESHOLD
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new AuditAnalysisError(`Failed to get workflow status: ${error.message}`);
  }
}

/**
 * Utility Functions
 */

/**
 * Process findings data into analysis categories
 * @param {Array} findings - Array of findings
 * @returns {Array} Processed analysis data by category
 */
function processFindings(findings) {
  const categories = Object.values(FINDING_CATEGORIES);
  const analysisData = [];

  categories.forEach(category => {
    const categoryFindings = findings.filter(f => f.category === category);
    const metrics = calculateCategoryMetrics(categoryFindings, category);
    
    analysisData.push({
      category,
      count: categoryFindings.length,
      percentage: findings.length > 0 ? (categoryFindings.length / findings.length) * 100 : 0,
      closed: metrics.closed,
      pending: metrics.pending
    });
  });

  return analysisData;
}

/**
 * Calculate metrics for a specific category
 * @param {Array} categoryFindings - Findings for specific category
 * @param {string} category - Finding category
 * @returns {Object} Category metrics
 */
function calculateCategoryMetrics(categoryFindings, category) {
  let closed = 0;
  let pending = 0;

  categoryFindings.forEach(finding => {
    if (category === FINDING_CATEGORIES.COMPLIANCE) {
      closed++; // Compliance findings don't require actions
    } else if (category === FINDING_CATEGORIES.NON_CONFORMITY) {
      const hasCompletedCA = finding.correctiveActions?.some(ca => 
        ca.status === 'CLOSED' || ca.isCompleted
      ) || false;
      hasCompletedCA ? closed++ : pending++;
    } else if (category === FINDING_CATEGORIES.IMPROVEMENT) {
      const hasCompletedPA = finding.preventiveActions?.some(pa => 
        pa.status === 'CLOSED' || pa.isCompleted
      ) || false;
      hasCompletedPA ? closed++ : pending++;
    }
  });

  return { closed, pending };
}

/**
 * Calculate workflow completion metrics
 * @param {Array} findings - Array of findings
 * @returns {Object} Workflow metrics
 */
function calculateWorkflowMetrics(findings) {
  const nonComplianceFindings = findings.filter(f => f.category === FINDING_CATEGORIES.NON_CONFORMITY);
  const improvementFindings = findings.filter(f => f.category === FINDING_CATEGORIES.IMPROVEMENT);
  
  const completedCorrectiveActions = nonComplianceFindings.filter(f => 
    f.correctiveActions?.some(ca => ca.status === 'CLOSED' || ca.status === 'VERIFIED')
  ).length;
  
  const completedPreventiveActions = improvementFindings.filter(f => 
    f.preventiveActions?.some(pa => pa.status === 'CLOSED')
  ).length;
  
  const totalWorkflows = nonComplianceFindings.length + improvementFindings.length;
  const completedWorkflows = completedCorrectiveActions + completedPreventiveActions;
  const completionPercentage = totalWorkflows > 0 ? (completedWorkflows / totalWorkflows) * 100 : 100;

  return {
    totalCorrectiveActions: nonComplianceFindings.length,
    completedCorrectiveActions,
    correctiveActionsCompleted: completedCorrectiveActions === nonComplianceFindings.length,
    totalPreventiveActions: improvementFindings.length,
    completedPreventiveActions,
    preventiveActionsCompleted: completedPreventiveActions === improvementFindings.length,
    completionPercentage
  };
}

/**
 * Send analysis completion notification
 * @param {Object} analysisData - Analysis data
 */
async function sendAnalysisCompletionNotification(analysisData) {
  try {
    // If teamLeaderId or tenantId are missing, try to get them from the analysis data or context
    let teamLeaderId = analysisData.teamLeaderId;
    let tenantId = analysisData.tenantId;
    
    // If missing, try to get from audit metadata
    if (!teamLeaderId || !tenantId) {
      try {
        const audit = await prisma.audit.findUnique({
          where: { id: analysisData.auditId },
          include: { 
            auditProgram: true,
            teamMembers: {
              where: { role: 'LEAD_AUDITOR' },
              take: 1
            }
          }
        });
        
        if (!tenantId) {
          tenantId = audit?.auditProgram?.tenantId;
        }
        
        if (!teamLeaderId && audit?.teamMembers?.length > 0) {
          teamLeaderId = audit.teamMembers[0].userId;
        }
      } catch (error) {
        console.error('Error fetching audit context for notification:', error);
      }
    }
    
    // If still missing required fields, log warning and skip notification
    if (!teamLeaderId || !tenantId) {
      console.warn('Missing teamLeaderId or tenantId for notification, skipping broadcast');
      return;
    }

    await notificationService.broadcastNotification({
      title: 'Audit Analysis Completed',
      message: `Comprehensive audit analysis for Audit #${analysisData.auditId} has been completed by the team leader.`,
      type: 'AUDIT_ANALYSIS',
      priority: 'HIGH',
      auditId: analysisData.auditId,
      departmentId: analysisData.departmentId,
      actionUrl: `/analysis/view/${analysisData.auditId}/${analysisData.departmentId}`,
      actionText: 'View Analysis',
      metadata: {
        completedAt: new Date().toISOString(),
        analysisType: 'comprehensive'
      },
      senderId: teamLeaderId,
      tenantId: tenantId
    });
    
    console.log('Analysis completion notification sent successfully');
  } catch (error) {
    console.error('Failed to send analysis completion notification:', error);
    // Don't throw error to avoid failing the analysis save
  }
}

/**
 * Get audit metadata from database
 * @param {string} auditId - Audit identifier
 * @param {string} [departmentId] - Optional department identifier
 * @returns {Promise<Object>} Audit metadata
 */
async function getAuditMetadata(auditId, departmentId) {
  try {
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      include: { 
        auditProgram: true
      }
    });
    
    // Note: departmentId here is the department name, not the department ID
    // We don't need to query the department table since we're using the name directly
    const departmentName = departmentId || null;

    return {
      auditTitle: audit?.auditProgram?.title || `Audit ${auditId}`,
      auditType: audit?.type || 'INTERNAL_AUDIT',
      departmentName: departmentName ? `Department ${departmentName}` : null
    };
  } catch (error) {
    console.error('Error fetching audit metadata:', error);
    // Return fallback data if database query fails
    return {
      auditTitle: `Audit ${auditId}`,
      auditType: 'INTERNAL_AUDIT',
      departmentName: departmentId ? `Department ${departmentId}` : null
    };
  }
}

/**
 * Legacy MR notification function (maintained for backward compatibility)
 */
async function notifyMR({ analysis }) {
  try {
    // Fetch audit, program, and MR
    const audit = await prisma.audit.findUnique({
      where: { id: analysis.auditId },
      include: { auditProgram: true }
    });
    const tenantId = audit?.auditProgram?.tenantId;
    
    // Find MR role first
    const mrRole = await prisma.role.findFirst({
      where: { 
        name: 'MR',
        tenantId 
      }
    });
    
    const mrUser = mrRole ? await prisma.user.findFirst({
      where: {
        tenantId,
        OR: [
          { userRoles: { some: { roleId: mrRole.id } } },
          { userDepartmentRoles: { some: { roleId: mrRole.id } } }
        ]
      }
    }) : null;
    
    if (!mrUser) return;
    
    // Compose message
    const program = audit?.auditProgram?.title || '-';
    const auditType = audit?.type || '-';
    const department = analysis.department || 'All Departments';
    const metrics = analysis.metrics || [];
    const remarks = analysis.remarks || '-';
    
    // Table as markdown
    let table = '| FINDINGS | NO | % TOTAL | CLOSED | PENDING |\n|----------|----|---------|--------|---------|\n';
    for (const row of metrics) {
      table += `| ${row.type} | ${row.count} | ${row.percent} | ${row.closed ?? 'N/A'} | ${row.pending ?? 'N/A'} |\n`;
    }
    
    const messageBody = `**Audit Analysis Completed**\n\n` +
      `**Programme:** ${program}\n` +
      `**Audit Type:** ${auditType}\n` +
      `**Department:** ${department}\n\n` +
      `${table}\n` +
      `**Remarks:**\n${remarks}`;
    
    // Send message
    await messageService.sendMessage({
      senderId: analysis.submittedById,
      recipientId: mrUser.id,
      tenantId,
      subject: 'Audit Analysis Completed',
      body: messageBody,
      files: []
    });
    
    // Emit real-time notification to MR
    try {
      const socketService = require('./socketService');
      const io = socketService.getIO();
      io.to(`user:${mrUser.id}`).emit('notificationCreated', {
        type: 'AUDIT_ANALYSIS_COMPLETED',
        title: 'Audit Analysis Completed',
        message: `An audit analysis has been completed for program: ${program}, department: ${department}.`,
        tenantId,
        targetUserId: mrUser.id,
        link: `/auditors/audit-analysis?auditId=${analysis.auditId}${analysis.department ? `&department=${encodeURIComponent(analysis.department)}` : ''}`,
        metadata: { auditId: analysis.auditId, department: analysis.department },
        userId: mrUser.id,
      });
    } catch (err) {
      console.error('Failed to emit real-time notification to MR:', err);
    }
    
    // Mark as notified
    await prisma.auditAnalysis.update({
      where: { id: analysis.id },
      data: { mrNotified: true, mrNotifiedAt: new Date() }
    });
  } catch (error) {
    console.error('Failed to notify MR:', error);
    throw new AuditAnalysisError(`Failed to notify MR: ${error.message}`);
  }
}

module.exports = {
  // Legacy methods (maintained for backward compatibility)
  saveAuditAnalysis,
  getAuditAnalysis,
  
  // Modern comprehensive analysis methods
  getComprehensiveAnalysis,
  generateComprehensiveAnalysis,
  saveComprehensiveAnalysis,
  getDetailedFindings,
  getAnalysisForViewing,
  getWorkflowStatus,
  
  // Utility exports for testing
  processFindings,
  calculateWorkflowMetrics,
  
  // Error classes
  AuditAnalysisError,
  ValidationError,
  
  // Constants
  FINDING_CATEGORIES,
  WORKFLOW_COMPLETION_THRESHOLD
}; 