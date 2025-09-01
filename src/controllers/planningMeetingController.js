const planningMeetingService = require('../services/planningMeetingService');
const { logger } = require('../utils/logger.util');
const { AppError } = require('../../errors/app.error');

// Create a new planning meeting
const createPlanningMeeting = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { scheduledAt, notes, venue, attendances, agendas } = req.body;
    const createdById = req.user.userId;

    logger.info(`Creating planning meeting for audit: ${auditId} by user: ${createdById}`);

    const result = await planningMeetingService.createPlanningMeeting(auditId, {
      scheduledAt,
      notes,
      venue,
      attendances,
      agendas,
      createdById
    });

    res.status(201).json({
      success: true,
      message: 'Planning meeting created successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Get planning meeting by ID
const getPlanningMeetingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await planningMeetingService.getPlanningMeetingById(id);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Get planning meeting for a specific audit
const getPlanningMeetingForAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;

    logger.info(`Getting planning meeting for audit: ${auditId}`);

    const result = await planningMeetingService.getPlanningMeetingForAudit(auditId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Get all planning meetings for an audit
const getPlanningMeetingsByAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;

    const result = await planningMeetingService.getPlanningMeetingsByAudit(auditId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Update planning meeting
const updatePlanningMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes, status, venue, scheduledAt } = req.body;

    const result = await planningMeetingService.updatePlanningMeeting(id, {
      notes,
      status,
      venue,
      scheduledAt
    });

    res.status(200).json({
      success: true,
      message: 'Planning meeting updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Delete planning meeting
const deletePlanningMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;

    await planningMeetingService.deletePlanningMeeting(id);

    res.status(200).json({
      success: true,
      message: 'Planning meeting deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Archive planning meeting
const archivePlanningMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await planningMeetingService.archivePlanningMeeting(id);

    res.status(200).json({
      success: true,
      message: 'Planning meeting archived successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Add or update attendance
const addOrUpdateAttendance = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { userId, present, remarks } = req.body;

    const result = await planningMeetingService.addOrUpdateAttendance(meetingId, {
      userId,
      present,
      remarks
    });

    res.status(200).json({
      success: true,
      message: 'Attendance updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Get attendance for a meeting
const getAttendance = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const result = await planningMeetingService.getAttendance(meetingId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Add agenda item
const addAgendaItem = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { agendaText, order, notes } = req.body;

    const result = await planningMeetingService.addAgendaItem(meetingId, {
      agendaText,
      order,
      notes
    });

    res.status(201).json({
      success: true,
      message: 'Agenda item added successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Update agenda item
const updateAgendaItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { agendaText, order, discussed, notes } = req.body;

    const result = await planningMeetingService.updateAgendaItem(id, {
      agendaText,
      order,
      discussed,
      notes
    });

    res.status(200).json({
      success: true,
      message: 'Agenda item updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Delete agenda item
const deleteAgendaItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    await planningMeetingService.deleteAgendaItem(id);

    res.status(200).json({
      success: true,
      message: 'Agenda item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Get agenda items for a meeting
const getAgendaItems = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const result = await planningMeetingService.getAgendaItems(meetingId);

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Batch update meeting with all related data
const batchUpdateMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes, status, venue, attendances, agendas } = req.body;

    const result = await planningMeetingService.batchUpdateMeeting(id, {
      notes,
      status,
      venue,
      attendances,
      agendas
    });

    res.status(200).json({
      success: true,
      message: 'Planning meeting updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Start planning meeting
const startPlanningMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await planningMeetingService.startPlanningMeeting(id);

    res.status(200).json({
      success: true,
      message: 'Planning meeting started successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Complete planning meeting
const completePlanningMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await planningMeetingService.completePlanningMeeting(id);

    res.status(200).json({
      success: true,
      message: 'Planning meeting completed successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Cancel planning meeting
const cancelPlanningMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await planningMeetingService.cancelPlanningMeeting(id);

    res.status(200).json({
      success: true,
      message: 'Planning meeting cancelled successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// Get planning meeting statistics
const getPlanningMeetingStats = async (req, res, next) => {
  try {
    const { tenantId } = req.user;

    const stats = await planningMeetingService.getPlanningMeetingStats(tenantId);

    res.status(200).json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPlanningMeeting,
  getPlanningMeetingById,
  getPlanningMeetingForAudit,
  getPlanningMeetingsByAudit,
  updatePlanningMeeting,
  deletePlanningMeeting,
  archivePlanningMeeting,
  addOrUpdateAttendance,
  getAttendance,
  addAgendaItem,
  updateAgendaItem,
  deleteAgendaItem,
  getAgendaItems,
  batchUpdateMeeting,
  startPlanningMeeting,
  completePlanningMeeting,
  cancelPlanningMeeting,
  getPlanningMeetingStats
}; 