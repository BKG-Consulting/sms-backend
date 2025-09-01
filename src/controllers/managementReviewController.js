const managementReviewService = require('../services/managementReviewService');
const { AppError } = require('../../errors/app.error');

/**
 * Send Management Review Invitation
 */
const sendManagementReviewInvitation = async (req, res, next) => {
  try {
  const { auditId } = req.params;
  const { meetingDate, startTime, endTime, venue } = req.body;
  const senderId = req.user.userId; // Use userId from the decoded token
  const { tenantId } = req.user;

  const result = await managementReviewService.sendManagementReviewInvitation(
    auditId,
    {
      senderId,
      meetingDate,
      startTime,
      endTime,
      venue
    },
    tenantId
  );

  res.status(200).json({
    status: 'success',
    data: result
  });
  } catch (error) {
    next(error);
  }
};

/**
 * Check Management Review Invitation Status
 */
const checkManagementReviewInvitationStatus = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { tenantId } = req.user;

    const result = await managementReviewService.checkManagementReviewInvitationStatus(
      auditId,
      tenantId
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new Management Review Meeting
 */
const createManagementReviewMeeting = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { notes, venue, scheduledAt, attendances, minutes } = req.body;
    const createdBy = req.user.userId;
    const { tenantId } = req.user;

    console.log('🔍 Controller received data:', {
      notes,
      venue,
      scheduledAt,
      attendancesCount: attendances ? Object.keys(attendances).length : 0,
      minutesCount: minutes ? minutes.length : 0,
      createdBy,
      user: req.user,
      userId: req.user.userId
    });

    const result = await managementReviewService.createManagementReviewMeeting(
      auditId,
      {
        notes,
        createdBy,
        venue,
        scheduledAt,
        attendances,
        minutes
      },
      tenantId
    );

    res.status(201).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    console.error('❌ Controller error:', error);
    next(error);
  }
};

/**
 * Get Management Review Meeting for an audit
 */
const getManagementReviewMeetingForAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { tenantId } = req.user;

    console.log('🔍 Controller: Fetching meeting for audit:', { auditId, tenantId });

    const result = await managementReviewService.getManagementReviewMeetingForAudit(
      auditId,
      tenantId
    );

    console.log('🔍 Controller: Result:', {
      hasMeeting: !!result.meeting,
      meetingId: result.meeting?.id,
      attendanceCount: result.meeting?.attendances?.length || 0
    });

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Management Review Meeting by ID
 */
const getManagementReviewMeetingById = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { tenantId } = req.user;

    const result = await managementReviewService.getManagementReviewMeetingById(
      meetingId,
      tenantId
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all Management Review Meetings for an audit
 */
const getManagementReviewMeetingsByAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { tenantId } = req.user;

    const result = await managementReviewService.getManagementReviewMeetingsByAudit(
      auditId,
      tenantId
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Management Review Meeting
 */
const updateManagementReviewMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { notes, venue, scheduledAt, status, attendances, minutes } = req.body;
    const { tenantId } = req.user;

    console.log('🔍 Controller updating meeting with data:', {
      meetingId,
      notes,
      attendancesCount: attendances ? Object.keys(attendances).length : 0,
      minutesCount: minutes ? minutes.length : 0
    });

    const result = await managementReviewService.updateManagementReviewMeeting(
      meetingId,
      {
        notes,
        venue,
        scheduledAt,
        status,
        attendances,
        minutes
      },
      tenantId
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Management Review Meeting
 */
const deleteManagementReviewMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { tenantId } = req.user;

    await managementReviewService.deleteManagementReviewMeeting(
      meetingId,
      tenantId
    );

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start Management Review Meeting
 */
const startManagementReviewMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { id: userId } = req.user;
    const { tenantId } = req.user;

    const result = await managementReviewService.startManagementReviewMeeting(
      meetingId,
      userId,
      tenantId
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete Management Review Meeting
 */
const completeManagementReviewMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { id: userId } = req.user;
    const { tenantId } = req.user;

    const result = await managementReviewService.completeManagementReviewMeeting(
      meetingId,
      userId,
      tenantId
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or Update Minute Item
 */
const createOrUpdateMinuteItem = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { title, order, notes } = req.body;
    const { tenantId } = req.user;

    const result = await managementReviewService.createOrUpdateMinuteItem(
      meetingId,
      {
        title,
        order,
        notes
      },
      tenantId
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Minute Item
 */
const updateMinuteItem = async (req, res, next) => {
  try {
    const { minuteId } = req.params;
    const { notes } = req.body;
    const { tenantId } = req.user;

    const result = await managementReviewService.updateMinuteItem(
      minuteId,
      {
        notes
      },
      tenantId
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Minute Item
 */
const deleteMinuteItem = async (req, res, next) => {
  try {
    const { minuteId } = req.params;
    const { tenantId } = req.user;

    await managementReviewService.deleteMinuteItem(
      minuteId,
      tenantId
    );

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or Update Attendance
 */
const createOrUpdateAttendance = async (req, res, next) => {
  try {
    const { meetingId, userId } = req.params;
    const { present, remarks } = req.body;
    const { tenantId } = req.user;

    const result = await managementReviewService.createOrUpdateAttendance(
      meetingId,
      userId,
      {
        present,
        remarks
      },
      tenantId
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Attendances for a meeting
 */
const getAttendancesByMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { tenantId } = req.user;

    const result = await managementReviewService.getAttendancesByMeeting(
      meetingId,
      tenantId
    );

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Management Review Minutes template
 */
const getManagementReviewMinutesTemplate = async (req, res, next) => {
  try {
    const { MANAGEMENT_REVIEW_MINUTES } = require('../services/managementReviewService');

    res.status(200).json({
      status: 'success',
      data: {
        minutes: MANAGEMENT_REVIEW_MINUTES
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get users with management review permission
 */
const getUsersWithManagementReviewPermission = async (req, res, next) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(400).json({
        status: 'error',
        message: 'Tenant ID not found in user context'
      });
    }

    const notificationService = require('../services/notificationService');
    const users = await notificationService.getUsersWithPermission(tenantId, 'managementReview', 'read');

    res.status(200).json({
      status: 'success',
      data: {
        users,
        count: users.length
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendManagementReviewInvitation,
  checkManagementReviewInvitationStatus,
  createManagementReviewMeeting,
  getManagementReviewMeetingForAudit,
  getManagementReviewMeetingById,
  getManagementReviewMeetingsByAudit,
  updateManagementReviewMeeting,
  deleteManagementReviewMeeting,
  startManagementReviewMeeting,
  completeManagementReviewMeeting,
  createOrUpdateMinuteItem,
  updateMinuteItem,
  deleteMinuteItem,
  createOrUpdateAttendance,
  getAttendancesByMeeting,
  getManagementReviewMinutesTemplate,
  getUsersWithManagementReviewPermission
}; 