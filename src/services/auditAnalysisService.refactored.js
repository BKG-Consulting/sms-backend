/**
 * Audit Analysis Service
 * Handles comprehensive audit analysis operations with proper error handling,
 * validation, and separation of concerns.
 */

const auditAnalysisRepository = require('../repositories/auditAnalysisRepository');
const messageService = require('./messageService');
const notificationService = require('./notificationService');

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

    // Try to get existing saved analysis first
    const existingAnalysis = await auditAnalysisRepository.getComprehensiveAnalysis(auditId, departmentId);
    if (existingAnalysis) {
      return existingAnalysis;
    }

    // Generate new analysis if none exists
    return await generateComprehensiveAnalysis(auditId, departmentId);
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

    // Get detailed findings
    const findings = await getDetailedFindings(auditId, departmentId);
    
    // Process findings by category
    const analysisData = processFindings(findings);
    
    // Calculate workflow completion metrics
    const workflowMetrics = calculateWorkflowMetrics(findings);
    
    // Get audit metadata (TODO: Replace with actual database call)
    const auditMetadata = await getAuditMetadata(auditId, departmentId);

    return {
      auditId,
      auditTitle: auditMetadata.auditTitle,
      auditType: auditMetadata.auditType,
      departmentId,
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
 * Get detailed findings for analysis
 * @param {string} auditId - Audit identifier
 * @param {string} [departmentId] - Optional department identifier
 * @returns {Promise<Array>} Array of detailed findings
 */
async function getDetailedFindings(auditId, departmentId = null) {
  try {
    validateAuditId(auditId);

    // TODO: Replace with actual database query
    // This should use the repository pattern to fetch real data
    console.warn('Using mock data - replace with actual database implementation');
    
    return getMockFindings(auditId, departmentId);
  } catch (error) {
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
    return await auditAnalysisRepository.getComprehensiveAnalysis(auditId, departmentId);
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
    
    const findings = await getDetailedFindings(auditId, departmentId);
    const metrics = calculateWorkflowMetrics(findings);
    
    return {
      auditId,
      departmentId,
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
  if (!analysisData.teamLeaderId || !analysisData.tenantId) {
    console.warn('Missing teamLeaderId or tenantId for notification');
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
    senderId: analysisData.teamLeaderId,
    tenantId: analysisData.tenantId
  });
}

/**
 * Get audit metadata (TODO: Implement actual database query)
 * @param {string} auditId - Audit identifier
 * @param {string} [departmentId] - Optional department identifier
 * @returns {Promise<Object>} Audit metadata
 */
async function getAuditMetadata(auditId, departmentId) {
  // TODO: Replace with actual database queries
  return {
    auditTitle: `Audit Program ${auditId}`,
    auditType: 'INTERNAL_AUDIT',
    departmentName: departmentId ? `Department ${departmentId}` : null
  };
}

/**
 * Generate mock findings (TODO: Remove when real data is available)
 * @param {string} auditId - Audit identifier
 * @param {string} [departmentId] - Optional department identifier
 * @returns {Array} Mock findings data
 */
function getMockFindings(auditId, departmentId) {
  return [
    {
      findingId: `finding-${auditId}-1`,
      description: 'Sample compliance finding',
      category: FINDING_CATEGORIES.COMPLIANCE,
      severity: 'LOW',
      departmentId: departmentId || 'dept-sample',
      department: {
        departmentId: departmentId || 'dept-sample',
        name: 'Sample Department'
      },
      correctiveActions: [],
      preventiveActions: []
    },
    {
      findingId: `finding-${auditId}-2`,
      description: 'Sample non-conformity finding',
      category: FINDING_CATEGORIES.NON_CONFORMITY,
      severity: 'HIGH',
      departmentId: departmentId || 'dept-sample',
      department: {
        departmentId: departmentId || 'dept-sample',
        name: 'Sample Department'
      },
      correctiveActions: [
        {
          actionId: 'ca-1',
          description: 'Corrective action 1',
          status: 'CLOSED',
          isCompleted: true,
          workflow: { status: 'APPROVED' }
        }
      ],
      preventiveActions: []
    },
    {
      findingId: `finding-${auditId}-3`,
      description: 'Sample improvement opportunity',
      category: FINDING_CATEGORIES.IMPROVEMENT,
      severity: 'MEDIUM',
      departmentId: departmentId || 'dept-sample',
      department: {
        departmentId: departmentId || 'dept-sample',
        name: 'Sample Department'
      },
      correctiveActions: [],
      preventiveActions: [
        {
          actionId: 'pa-1',
          description: 'Preventive action 1',
          status: 'IN_PROGRESS',
          isCompleted: false,
          workflow: { status: 'PENDING' }
        }
      ]
    }
  ];
}

/**
 * Legacy MR notification function (maintained for backward compatibility)
 * TODO: Refactor to use modern notification service
 */
async function notifyMR({ analysis }) {
  try {
    // Implementation maintained for backward compatibility
    // Consider refactoring to use the new notification service
    console.log('Legacy MR notification for analysis:', analysis.id);
    
    // Mark as notified in repository
    // await auditAnalysisRepository.markMRNotified(analysis.id);
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
