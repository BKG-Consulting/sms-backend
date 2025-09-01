/**
 * Optimized Meeting Controllers
 * Uses batch operations to reduce database connections
 * while maintaining separate meeting types
 */

const openingMeetingService = require('../services/openingMeetingService');
const closingMeetingService = require('../services/closingMeetingService');
const { logger } = require('../utils/logger.util');

// ===== OPENING MEETING CONTROLLERS =====

/**
 * Create opening meeting with all data in single transaction
 * POST /api/audits/:auditId/opening-meetings/batch
 */
const createOpeningMeetingWithData = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { 
      scheduledAtLocal, 
      timeZone, 
      venue, 
      notes,
      attendance = [],
      agendas = []
    } = req.body;
    const createdById = req.user.userId;

    const meeting = await openingMeetingService.createOpeningMeetingWithData({
      auditId,
      createdById,
      scheduledAtLocal,
      timeZone,
      venue,
      notes,
      attendance,
      agendas
    });

    logger.info('Opening meeting created with batch data via API', {
      meetingId: meeting.id,
      auditId,
      createdById,
      attendanceCount: attendance.length,
      agendaCount: agendas.length
    });

    res.status(201).json({
      message: 'Opening meeting created successfully with all data',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Batch update opening meeting with all data
 * PUT /api/opening-meetings/:meetingId/batch
 */
const batchUpdateOpeningMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { 
      notes,
      venue,
      status,
      attendance = [],
      agendas = []
    } = req.body;
    const updatedBy = req.user.userId;

    const meeting = await openingMeetingService.batchUpdateOpeningMeeting(
      meetingId,
      {
        notes,
        venue,
        status,
        attendance,
        agendas
      },
      updatedBy
    );

    logger.info('Opening meeting batch updated via API', {
      meetingId,
      updatedBy,
      attendanceCount: attendance.length,
      agendaCount: agendas.length
    });

    res.json({
      message: 'Opening meeting updated successfully with all data',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Create opening meeting with user-provided data (clean approach)
 * POST /api/audits/:auditId/opening-meetings/user-driven
 */
const createOpeningMeetingUserDriven = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { 
      scheduledAtLocal, 
      timeZone, 
      venue, 
      notes,
      attendance = [],
      agendas = []
    } = req.body;
    const createdById = req.user.userId;

    const meeting = await openingMeetingService.createOpeningMeetingUserDriven({
      auditId,
      createdById,
      scheduledAtLocal,
      timeZone,
      venue,
      notes,
      attendance,
      agendas
    });

    logger.info('Opening meeting created with user-driven approach via API', {
      meetingId: meeting.id,
      auditId,
      createdById,
      attendanceCount: attendance.length,
      agendaCount: agendas.length
    });

    res.status(201).json({
      message: 'Opening meeting created successfully with user-provided data',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get default opening meeting agendas for UI suggestions
 * GET /api/audits/:auditId/opening-meetings/default-agendas
 */
const getDefaultOpeningAgendas = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { tenantId } = req.user;

    const agendas = await openingMeetingService.getDefaultOpeningAgendas(tenantId);

    res.json({
      message: 'Default opening meeting agendas retrieved successfully',
      agendas
    });

  } catch (error) {
    next(error);
  }
};

// ===== CLOSING MEETING CONTROLLERS =====

/**
 * Create closing meeting with all data in single transaction
 * POST /api/audits/:auditId/closing-meetings/batch
 */
const createClosingMeetingWithData = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { 
      scheduledAtLocal, 
      timeZone, 
      venue, 
      notes,
      attendance = [],
      agendas = []
    } = req.body;
    const createdById = req.user.userId;

    const meeting = await closingMeetingService.createClosingMeetingWithData({
      auditId,
      createdById,
      scheduledAtLocal,
      timeZone,
      venue,
      notes,
      attendance,
      agendas
    });

    logger.info('Closing meeting created with batch data via API', {
      meetingId: meeting.id,
      auditId,
      createdById,
      attendanceCount: attendance.length,
      agendaCount: agendas.length
    });

    res.status(201).json({
      message: 'Closing meeting created successfully with all data',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Batch update closing meeting with all data
 * PUT /api/closing-meetings/:meetingId/batch
 */
const batchUpdateClosingMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { 
      notes,
      venue,
      status,
      attendance = [],
      agendas = []
    } = req.body;
    const updatedBy = req.user.userId;

    const meeting = await closingMeetingService.batchUpdateClosingMeeting(
      meetingId,
      {
        notes,
        venue,
        status,
        attendance,
        agendas
      },
      updatedBy
    );

    logger.info('Closing meeting batch updated via API', {
      meetingId,
      updatedBy,
      attendanceCount: attendance.length,
      agendaCount: agendas.length
    });

    res.json({
      message: 'Closing meeting updated successfully with all data',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Create closing meeting with user-provided data (clean approach)
 * POST /api/audits/:auditId/closing-meetings/user-driven
 */
const createClosingMeetingUserDriven = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { 
      scheduledAtLocal, 
      timeZone, 
      venue, 
      notes,
      attendance = [],
      agendas = []
    } = req.body;
    const createdById = req.user.userId;

    const meeting = await closingMeetingService.createClosingMeetingUserDriven({
      auditId,
      createdById,
      scheduledAtLocal,
      timeZone,
      venue,
      notes,
      attendance,
      agendas
    });

    logger.info('Closing meeting created with user-driven approach via API', {
      meetingId: meeting.id,
      auditId,
      createdById,
      attendanceCount: attendance.length,
      agendaCount: agendas.length
    });

    res.status(201).json({
      message: 'Closing meeting created successfully with user-provided data',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get default closing meeting agendas for UI suggestions
 * GET /api/audits/:auditId/closing-meetings/default-agendas
 */
const getDefaultClosingAgendas = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { tenantId } = req.user;

    const agendas = await closingMeetingService.getDefaultClosingAgendas(tenantId);

    res.json({
      message: 'Default closing meeting agendas retrieved successfully',
      agendas
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  // Opening Meeting Controllers
  createOpeningMeetingWithData,
  batchUpdateOpeningMeeting,
  createOpeningMeetingUserDriven,
  getDefaultOpeningAgendas,
  
  // Closing Meeting Controllers
  createClosingMeetingWithData,
  batchUpdateClosingMeeting,
  createClosingMeetingUserDriven,
  getDefaultClosingAgendas
}; 