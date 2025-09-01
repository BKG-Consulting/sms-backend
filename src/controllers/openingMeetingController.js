/**
 * Opening Meeting Controller
 * Handles HTTP requests for opening meeting operations
 */

const openingMeetingService = require('../services/openingMeetingService');
const { logger } = require('../utils/logger.util');

/**
 * Create a new opening meeting
 * POST /api/audits/:auditId/opening-meetings
 */
const createOpeningMeeting = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { 
      scheduledAtLocal, 
      timeZone, 
      venue, 
      notes, 
      attendance 
    } = req.body;
    const createdById = req.user.userId;

    const meeting = await openingMeetingService.createOpeningMeeting({
      auditId,
      createdById,
      scheduledAtLocal,
      timeZone,
      venue,
      notes,
      attendance
    });

    logger.info('Opening meeting created via API', {
      meetingId: meeting.id,
      auditId,
      createdById
    });

    res.status(201).json({
      message: 'Opening meeting created successfully',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get opening meeting by ID
 * GET /api/opening-meetings/:meetingId
 */
const getOpeningMeetingById = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const meeting = await openingMeetingService.getOpeningMeetingById(meetingId);

    res.json({
      message: 'Opening meeting fetched successfully',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get opening meeting for a specific audit
 * GET /api/audits/:auditId/opening-meeting
 */
const getOpeningMeetingByAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;

    const meeting = await openingMeetingService.getOpeningMeetingByAudit(auditId);

    if (!meeting) {
      return res.status(404).json({
        message: 'No opening meeting found for this audit'
      });
    }

    res.json({
      message: 'Opening meeting fetched successfully',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Update opening meeting attendance
 * POST /api/opening-meetings/:meetingId/attendance
 */
const updateAttendance = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { userId, present, remarks } = req.body;
    const updatedBy = req.user.userId;

    const attendance = await openingMeetingService.updateAttendance(
      meetingId,
      userId,
      present,
      remarks,
      updatedBy
    );

    logger.info('Opening meeting attendance updated via API', {
      meetingId,
      userId,
      present,
      updatedBy
    });

    res.json({
      message: 'Attendance updated successfully',
      attendance
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Update agenda item discussion status
 * PUT /api/opening-meetings/agenda/:agendaId
 */
const updateAgendaDiscussed = async (req, res, next) => {
  try {
    const { agendaId } = req.params;
    const { discussed, notes } = req.body;
    const updatedBy = req.user.userId;

    const agenda = await openingMeetingService.updateAgendaDiscussed(
      agendaId,
      discussed,
      notes,
      updatedBy
    );

    logger.info('Opening meeting agenda updated via API', {
      agendaId,
      discussed,
      updatedBy
    });

    res.json({
      message: 'Agenda item updated successfully',
      agenda
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Update meeting notes
 */
const updateMeetingNotes = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { notes } = req.body;
    const updatedBy = req.user.userId;

    const meeting = await openingMeetingService.updateMeetingNotes(meetingId, notes, updatedBy);
    
    res.status(200).json({ 
      message: 'Meeting notes updated successfully', 
      meeting 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start an opening meeting
 * PATCH /api/opening-meetings/:meetingId/start
 */
const startMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const startedBy = req.user.userId;

    const meeting = await openingMeetingService.startMeeting(meetingId, startedBy);

    logger.info('Opening meeting started via API', {
      meetingId,
      startedBy
    });

    res.json({
      message: 'Opening meeting started successfully',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Complete an opening meeting
 * PATCH /api/opening-meetings/:meetingId/complete
 */
const completeMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const completedBy = req.user.userId;

    const meeting = await openingMeetingService.completeMeeting(meetingId, completedBy);

    logger.info('Opening meeting completed via API', {
      meetingId,
      completedBy
    });

    res.json({
      message: 'Opening meeting completed successfully',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Archive an opening meeting
 * DELETE /api/opening-meetings/:meetingId
 */
const archiveMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const archivedBy = req.user.userId;

    const meeting = await openingMeetingService.archiveMeeting(meetingId, archivedBy);

    logger.info('Opening meeting archived via API', {
      meetingId,
      archivedBy
    });

    res.json({
      message: 'Opening meeting archived successfully',
      meeting
    });

  } catch (error) {
    next(error);
  }
};

const getOpeningMeetingAttendees = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const tenantId = req.user.tenantId;

    const attendees = await openingMeetingService.getOpeningMeetingAttendees(auditId, tenantId);
    
    res.status(200).json({ 
      message: 'Opening meeting attendees retrieved successfully', 
      attendees 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOpeningMeeting,
  getOpeningMeetingById,
  getOpeningMeetingByAudit,
  updateAttendance,
  updateAgendaDiscussed,
  updateMeetingNotes,
  startMeeting,
  completeMeeting,
  archiveMeeting,
  getOpeningMeetingAttendees
}; 