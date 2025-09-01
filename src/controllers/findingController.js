const findingService = require('../services/findingService');
const { prisma } = require('../../prisma/client');

const createFinding = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { department, title, description, criteria, attachments } = req.body;
    const createdById = req.user.userId;
    const finding = await findingService.createFinding({
      auditId,
      createdById,
      department,
      title,
      description,
      criteria,
      attachments,
    });
    res.status(201).json({ message: 'Finding created', finding });
  } catch (error) {
    next(error);
  }
};

const getFindingsByAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { userId } = req.query; // Optional: filter by user's checklist scope
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ 
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }
    
    console.log('🔍 Getting findings for audit:', { auditId, userId, tenantId });
    
    // If userId is provided, filter by user's checklist scope
    if (userId) {
      const findings = await findingService.getFindingsByAuditWithUserScope(auditId, tenantId, userId);
      res.json({ message: 'Findings fetched (filtered by user scope)', findings });
    } else {
      const findings = await findingService.getFindingsByAudit(auditId, tenantId);
      res.json({ message: 'Findings fetched', findings });
    }
  } catch (error) {
    next(error);
  }
};

const getFindingById = async (req, res, next) => {
  try {
    const { findingId } = req.params;
    const finding = await findingService.getFindingById(findingId);
    if (!finding) return res.status(404).json({ message: 'Finding not found' });
    res.json({ message: 'Finding fetched', finding });
  } catch (error) {
    next(error);
  }
};

const updateFinding = async (req, res, next) => {
  try {
    const { findingId } = req.params;
    // Accept classification fields in the body for atomic non-conformity update
    const { nonConformityType, nonConformitySeverity, ...rest } = req.body;
    const finding = await findingService.updateFinding(findingId, {
      ...rest,
      nonConformityType,
      nonConformitySeverity,
    });
    res.json({ message: 'Finding updated', finding });
  } catch (error) {
    next(error);
  }
};

const deleteFinding = async (req, res, next) => {
  try {
    const { findingId } = req.params;
    await findingService.deleteFinding(findingId);
    res.json({ message: 'Finding deleted' });
  } catch (error) {
    next(error);
  }
};

const commitFindings = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { department } = req.body; // Optional: commit by department
    const userId = req.user.userId;
    await findingService.commitFindings({ auditId, department, userId });
    res.json({ message: 'Findings committed and HOD notified.' });
  } catch (error) {
    next(error);
  }
};

const hodReviewFinding = async (req, res, next) => {
  try {
    const { findingId } = req.params;
    const userId = req.user.userId;
    const { status, hodFeedback } = req.body;
    const finding = await findingService.hodReviewFinding({ findingId, userId, status, hodFeedback });
    res.json({ message: 'Finding reviewed', finding });
  } catch (error) {
    next(error);
  }
};

const finishFindingsReview = async (req, res, next) => {
  try {
    const { auditId } = req.body;
    const { department } = req.body;
    const userId = req.user.userId;
    await findingService.finishFindingsReview({ auditId, department, userId });
    res.json({ message: 'Findings review finished and team notified.' });
  } catch (error) {
    next(error);
  }
};

const finishCategorization = async (req, res, next) => {
  try {
    const { auditId, department } = req.body;
    const userId = req.user.userId;
    await findingService.finishCategorization({ auditId, department, userId });
    res.json({ message: 'Findings categorization finished and MR notified.' });
  } catch (error) {
    next(error);
  }
};

const getGlobalFindings = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ 
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }
    
    const filters = { ...req.query, tenantId }; // Add tenantId to filters
    const { findings, total } = await findingService.getGlobalFindings(filters);
    const page = parseInt(filters.page, 10) || 1;
    const pageSize = parseInt(filters.pageSize, 10) || 10;
    res.json({ message: 'Global findings fetched', findings, total, page, pageSize });
  } catch (error) {
    next(error);
  }
};

const getNonConformities = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ 
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }
    
    const filters = { ...req.query, tenantId }; // Add tenantId to filters
    const { nonConformities, total } = await findingService.getNonConformities(filters);
    const page = parseInt(filters.page, 10) || 1;
    const pageSize = parseInt(filters.pageSize, 10) || 10;
    res.json({ 
      message: 'Non-conformities fetched', 
      nonConformities, 
      total, 
      page, 
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    next(error);
  }
};

const getNonConformityById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const nonConformity = await prisma.nonConformity.findUnique({
      where: { id },
      include: {
        finding: true,
        createdBy: true,
      },
    });
    if (!nonConformity) return res.status(404).json({ message: 'Non-conformity not found' });
    res.json({ nonConformity });
  } catch (error) {
    next(error);
  }
};

const updateNonConformity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, severity } = req.body;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    // Verify the non-conformity exists and belongs to the user's tenant
    const existingNonConformity = await prisma.nonConformity.findFirst({
      where: { 
        id,
        finding: {
          audit: {
            auditProgram: {
              tenantId: tenantId
            }
          }
        }
      }
    });

    if (!existingNonConformity) {
      return res.status(404).json({ message: 'Non-conformity not found' });
    }

    // Update the non-conformity
    const updatedNonConformity = await prisma.nonConformity.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(severity && { severity }),
        updatedAt: new Date()
      },
      include: {
        finding: true,
        createdBy: true,
      },
    });

    res.json({ 
      message: 'Non-conformity updated successfully', 
      nonConformity: updatedNonConformity 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validate user access to a specific finding
 */
const validateFindingAccess = async (req, res, next) => {
  try {
    const { findingId, userId } = req.params;
    
    console.log('🔒 Validating finding access:', { findingId, userId });
    
    // Get the finding
    const finding = await findingService.getFindingById(findingId);
    if (!finding) {
      return res.status(404).json({
        status: 'error',
        message: 'Finding not found'
      });
    }
    
    // Get user's checklist scope for the audit
    const checklistService = require('../services/checklistService');
    const checklists = await checklistService.getChecklistsByAudit(finding.auditId);
    
    // Check if user has access to the finding's department
    let hasAccess = false;
    const allowedDepartments = [];
    const assignedChecklists = [];
    
    for (const checklist of checklists) {
      const isAssigned = checklist.assignees?.some(assignee => assignee.userId === userId) ||
                        checklist.createdBy?.id === userId;
      
      if (isAssigned && checklist.department) {
        const departments = checklist.department.split(',').map(d => d.trim());
        allowedDepartments.push(...departments);
        assignedChecklists.push(checklist.id);
        
        if (departments.includes(finding.department)) {
          hasAccess = true;
        }
      }
    }
    
    console.log('🔒 Access validation result:', { hasAccess, allowedDepartments, assignedChecklists });
    
    res.json({
      status: 'success',
      data: {
        isValid: hasAccess,
        allowedDepartments: [...new Set(allowedDepartments)], // Remove duplicates
        assignedChecklists
      }
    });
  } catch (error) {
    console.error('❌ Error validating finding access:', error);
    next(error);
  }
};

module.exports = {
  createFinding,
  getFindingsByAudit,
  getFindingById,
  updateFinding,
  deleteFinding,
  commitFindings,
  hodReviewFinding,
  finishFindingsReview,
  finishCategorization,
  getGlobalFindings,
  getNonConformities,
  getNonConformityById,
  updateNonConformity,
  validateFindingAccess,
}; 