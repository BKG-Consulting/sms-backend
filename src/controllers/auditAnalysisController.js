const auditAnalysisService = require('../services/auditAnalysisService');

// Legacy methods (existing)
async function saveAuditAnalysis(req, res, next) {
  try {
    const { auditId, department, metrics, remarks, finished } = req.body;
    const submittedById = req.user.id || req.user.userId;
    if (!auditId || !metrics || !remarks) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const analysis = await auditAnalysisService.saveAuditAnalysis({
      auditId,
      department,
      submittedById,
      metrics,
      remarks,
      finished: !!finished,
    });
    res.status(200).json({ success: true, analysis });
  } catch (err) {
    next(err);
  }
}

async function getAuditAnalysis(req, res, next) {
  try {
    const { auditId, department } = req.query;
    if (!auditId) return res.status(400).json({ success: false, message: 'Missing auditId' });
    const analysis = await auditAnalysisService.getAuditAnalysis(auditId, department);
    res.status(200).json({ success: true, analysis });
  } catch (err) {
    next(err);
  }
}

// New comprehensive analysis methods
async function getComprehensiveAnalysis(req, res, next) {
  try {
    const { auditId, departmentId } = req.query;
    if (!auditId) {
      return res.status(400).json({ success: false, message: 'Audit ID is required' });
    }
    
    // Decode departmentId if it exists to handle URL encoding
    const decodedDepartmentId = departmentId ? decodeURIComponent(departmentId) : null;
    
    const analysis = await auditAnalysisService.getComprehensiveAnalysis(auditId, decodedDepartmentId);
    res.status(200).json(analysis);
  } catch (err) {
    next(err);
  }
}

async function saveComprehensiveAnalysis(req, res, next) {
  try {
    const analysisData = req.body;
    const userId = req.user.id || req.user.userId;
    const tenantId = req.user.tenantId;
    
    if (!analysisData.auditId) {
      return res.status(400).json({ success: false, message: 'Audit ID is required' });
    }
    
    const result = await auditAnalysisService.saveComprehensiveAnalysis({
      ...analysisData,
      submittedById: userId,
      teamLeaderId: userId, // The person saving is the team leader
      tenantId: tenantId
    });
    
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getDetailedFindings(req, res, next) {
  try {
    const { auditId } = req.params;
    const { departmentId } = req.query;
    
    if (!auditId) {
      return res.status(400).json({ success: false, message: 'Audit ID is required' });
    }
    
    // Decode departmentId if it exists to handle URL encoding
    const decodedDepartmentId = departmentId ? decodeURIComponent(departmentId) : null;
    
    const findings = await auditAnalysisService.getDetailedFindings(auditId, decodedDepartmentId);
    res.status(200).json({ findings });
  } catch (err) {
    next(err);
  }
}

async function getAnalysisForViewing(req, res, next) {
  try {
    const { auditId } = req.params;
    const { departmentId } = req.query;
    
    if (!auditId) {
      return res.status(400).json({ success: false, message: 'Audit ID is required' });
    }
    
    // Decode departmentId if it exists to handle URL encoding
    const decodedDepartmentId = departmentId ? decodeURIComponent(departmentId) : null;
    
    const analysis = await auditAnalysisService.getAnalysisForViewing(auditId, decodedDepartmentId);
    res.status(200).json(analysis);
  } catch (err) {
    next(err);
  }
}

async function getWorkflowStatus(req, res, next) {
  try {
    const { auditId, departmentId } = req.query;
    
    if (!auditId) {
      return res.status(400).json({ success: false, message: 'Audit ID is required' });
    }
    
    // Decode departmentId if it exists to handle URL encoding
    const decodedDepartmentId = departmentId ? decodeURIComponent(departmentId) : null;
    
    const status = await auditAnalysisService.getWorkflowStatus(auditId, decodedDepartmentId);
    res.status(200).json(status);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  // Legacy methods
  saveAuditAnalysis,
  getAuditAnalysis,
  // New comprehensive analysis methods
  getComprehensiveAnalysis,
  saveComprehensiveAnalysis,
  getDetailedFindings,
  getAnalysisForViewing,
  getWorkflowStatus,
}; 