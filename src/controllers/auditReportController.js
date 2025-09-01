const auditReportService = require('../services/auditReportService');
const { logger } = require('../utils/logger');

const generateAuditReport = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { userId, tenantId } = req.user;

    const result = await auditReportService.generateAuditReport(auditId, tenantId, userId);
    
    logger.info('Audit report generated successfully', { auditId, userId, tenantId });
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error generating audit report:', error);
    next(error);
  }
};

const getAuditReportStats = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { tenantId } = req.user;

    const stats = await auditReportService.getAuditReportStats(auditId, tenantId);
    
    res.status(200).json({ message: 'Audit report statistics retrieved successfully', stats });
  } catch (error) {
    logger.error('Error fetching audit report stats:', error);
    next(error);
  }
};

const getCategorizationStatus = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { tenantId } = req.user;

    const status = await auditReportService.getAuditCategorizationStatus(auditId, tenantId);
    
    logger.info('Categorization status retrieved successfully', { auditId, tenantId });
    res.status(200).json({ message: 'Categorization status retrieved successfully', ...status });
  } catch (error) {
    logger.error('Error getting categorization status:', error);
    next(error);
  }
};

const generatePartialReport = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { scopes } = req.body;
    const { userId, tenantId } = req.user;

    if (!scopes || !Array.isArray(scopes) || scopes.length === 0) {
      return res.status(400).json({ message: 'Scopes array is required for partial report generation' });
    }

    const result = await auditReportService.generateAuditReport(auditId, tenantId, userId, {
      isPartial: true,
      scopes: scopes
    });
    
    logger.info('Partial audit report generated successfully', { auditId, userId, tenantId, scopes });
    res.status(200).json(result);
  } catch (error) {
    logger.error('Error generating partial audit report:', error);
    next(error);
  }
};

const getAllAuditReports = async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { prisma } = require('../../prisma/client');

    // Fetch all audit report documents for this tenant
    const auditReportDocuments = await prisma.document.findMany({
      where: {
        tenantId,
        type: 'AUDIT_REPORT'
      },
      include: {
        currentVersion: true,
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Extract audit information from document titles and fetch stats
    const reports = [];
    
    for (const doc of auditReportDocuments) {
      try {
        // Parse audit ID from document title
        // Expected format: "Audit Report - {auditTitle} (Audit #{auditNo})"
        const titleMatch = doc.title.match(/Audit Report - (.+?) \(Audit #(\d+)\)/);
        if (!titleMatch) continue;
        
        const auditTitle = titleMatch[1];
        const auditNo = parseInt(titleMatch[2]);
        
        // Find the corresponding audit
        const audit = await prisma.audit.findFirst({
          where: {
            auditNo: auditNo,
            auditProgram: {
              tenantId: tenantId
            }
          },
          select: {
            id: true,
            auditNo: true,
            type: true,
            auditProgramId: true,
            status: true,
            // Get the audit program title instead of audit title
            auditProgram: {
              select: {
                id: true,
                title: true,
                description: true
              }
            }
          }
        });
        
        if (!audit) continue;
        
        // Get stats for this audit
        const stats = await auditReportService.getAuditReportStats(audit.id, tenantId);
        
        reports.push({
          id: doc.id,
          auditId: audit.id,
          auditTitle: audit.auditProgram?.title || `Audit ${audit.auditNo}`, // Use program title or fallback
          auditNo: audit.auditNo.toString(),
          auditType: audit.type,
          status: doc.status,
          generatedAt: doc.createdAt,
          generatedBy: `${doc.owner?.firstName || ''} ${doc.owner?.lastName || ''}`.trim() || 'Unknown',
          stats: stats,
          document: {
            id: doc.id,
            title: doc.title,
            type: doc.type,
            status: doc.status,
            tenantId: doc.tenantId,
            ownerId: doc.ownerId,
            currentVersionId: doc.currentVersionId,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            currentVersion: doc.currentVersion,
            owner: doc.owner
          }
        });
      } catch (error) {
        logger.error('Error processing audit report document:', { documentId: doc.id, error: error.message });
        // Continue with other documents
      }
    }
    
    logger.info('Audit reports retrieved successfully', { tenantId, count: reports.length });
    res.status(200).json({ 
      message: 'Audit reports retrieved successfully', 
      reports 
    });
  } catch (error) {
    logger.error('Error fetching all audit reports:', error);
    next(error);
  }
};

module.exports = {
  generateAuditReport,
  getCategorizationStatus,
  generatePartialReport,
  getAuditReportStats,
  getAllAuditReports
};