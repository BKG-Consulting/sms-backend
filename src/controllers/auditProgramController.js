const auditProgramService = require('../services/auditProgramService');
const { logger } = require('../utils/logger.util');

const createAuditProgram = async (req, res, next) => {
  try {
    const { title, objectives } = req.body;
    const tenantId = req.user.tenantId;
    const createdBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const auditProgram = await auditProgramService.createAuditProgram({
      title,
      objectives,
      tenantId,
      createdBy
    });

    logger.info('Audit program created via API', {
      programId: auditProgram.id,
      title,
      tenantId,
      createdBy
    });

    res.status(201).json({
      message: 'Audit program created successfully',
      auditProgram
    });
  } catch (error) {
    next(error);
  }
};

const getAuditProgramsByTenant = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const { status, includeAudits, includeCreator, page, limit } = req.query;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const options = {
      status: status || undefined,
      includeAudits: includeAudits === 'true',
      includeCreator: includeCreator !== 'false',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10
    };

    const { data, total, totalPages, currentPage, pageSize } = await auditProgramService.getAuditProgramsByTenant(tenantId, options);

    logger.info('Audit programs fetched via API', {
      tenantId,
      count: data.length,
      filters: options,
      total
    });

    res.json({
      message: 'Audit programs fetched successfully',
      data,
      total,
      totalPages,
      page: currentPage,
      limit: pageSize
    });
  } catch (error) {
    next(error);
  }
};

const getAuditProgramById = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const auditProgram = await auditProgramService.getAuditProgramById(programId, tenantId);

    logger.info('Audit program fetched via API', {
      programId,
      tenantId
    });

    res.json({
      message: 'Audit program fetched successfully',
      auditProgram
    });
  } catch (error) {
    next(error);
  }
};

const updateAuditProgram = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { title, objectives } = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const auditProgram = await auditProgramService.updateAuditProgram({
      programId,
      updates: {
        title,
        objectives
      },
      tenantId,
      updatedBy
    });

    logger.info('Audit program updated via API', {
      programId,
      title,
      tenantId,
      updatedBy
    });

    res.json({
      message: 'Audit program updated successfully',
      auditProgram
    });
  } catch (error) {
    next(error);
  }
};

const commitAuditProgram = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const tenantId = req.user.tenantId;
    const committedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const auditProgram = await auditProgramService.commitAuditProgram({ programId, tenantId, committedBy });

    logger.info('Audit program committed via API', {
      programId,
      tenantId,
      committedBy
    });

    res.json({
      message: 'Audit program committed successfully',
      auditProgram
    });
  } catch (error) {
    next(error);
  }
};

const approveAuditProgram = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { approvalComment } = req.body;
    const tenantId = req.user.tenantId;
    const approvedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const auditProgram = await auditProgramService.approveAuditProgram({ programId, tenantId, approvedBy, approvalComment });

    logger.info('Audit program approved via API', {
      programId,
      tenantId,
      approvedBy,
      approvalComment
    });

    res.json({
      message: 'Audit program approved successfully',
      auditProgram
    });
  } catch (error) {
    next(error);
  }
};

const rejectAuditProgram = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const { rejectionComment } = req.body;
    const tenantId = req.user.tenantId;
    const rejectedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const auditProgram = await auditProgramService.rejectAuditProgram({ programId, tenantId, rejectedBy, rejectionComment });

    logger.info('Audit program rejected via API', {
      programId,
      tenantId,
      rejectedBy,
      rejectionComment
    });

    res.json({
      message: 'Audit program rejected successfully',
      auditProgram
    });
  } catch (error) {
    next(error);
  }
};



const getAuditProgramHistory = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const history = await auditProgramService.getAuditProgramHistory(programId, tenantId);

    res.json({
      message: 'Audit program history fetched successfully',
      history
    });
  } catch (error) {
    next(error);
  }
};

const exportAuditProgram = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const exportData = await auditProgramService.exportAuditProgram(programId, tenantId);

    logger.info('Audit program exported via API', {
      programId,
      tenantId
    });

    res.json({
      message: 'Audit program exported successfully',
      exportData
    });
  } catch (error) {
    next(error);
  }
};

const deleteAuditProgram = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const tenantId = req.user.tenantId;
    const deletedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    await auditProgramService.deleteAuditProgram({ programId, tenantId, deletedBy });

    logger.info('Audit program deleted via API', {
      programId,
      tenantId,
      deletedBy
    });

    res.json({
      message: 'Audit program deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const getAuditProgramStats = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const stats = await auditProgramService.getAuditProgramStats(tenantId);

    res.status(200).json({
      success: true,
      stats
    });
  } catch (error) {
    next(error);
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
  getAuditProgramStats,
  getAuditProgramHistory,
  exportAuditProgram,
  deleteAuditProgram,
}; 