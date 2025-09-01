/**
 * Closing Meeting Controller
 * Handles closing meeting API endpoints
 */

const closingMeetingService = require('../services/closingMeetingService');

/**
 * Create a new closing meeting
 */
const createClosingMeeting = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { scheduledAtLocal, timeZone, venue, notes } = req.body;
    const createdById = req.user.userId;

    const meeting = await closingMeetingService.createClosingMeeting({
      auditId,
      createdById,
      scheduledAtLocal,
      timeZone,
      venue,
      notes
    });

    res.status(201).json({ 
      message: 'Closing meeting created successfully', 
      meeting 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get closing meeting by ID
 */
const getClosingMeetingById = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const meeting = await closingMeetingService.getClosingMeetingById(meetingId);
    
    res.status(200).json({ 
      message: 'Closing meeting retrieved successfully', 
      meeting 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get closing meeting by audit ID
 */
const getClosingMeetingByAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;

    const meeting = await closingMeetingService.getClosingMeetingByAudit(auditId);
    
    if (!meeting) {
      return res.status(404).json({ 
        message: 'No closing meeting found for this audit',
        meeting: null
      });
    }
    
    res.status(200).json({ 
      message: 'Closing meeting retrieved successfully', 
      meeting 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update attendance for a closing meeting
 */
const updateAttendance = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { userId, present, remarks } = req.body;
    const updatedBy = req.user.userId;

    const attendance = await closingMeetingService.updateAttendance(
      meetingId, 
      userId, 
      present, 
      remarks, 
      updatedBy
    );
    
    res.status(200).json({ 
      message: 'Attendance updated successfully', 
      attendance 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update agenda item discussion status
 */
const updateAgendaDiscussed = async (req, res, next) => {
  try {
    const { agendaId } = req.params;
    const { discussed, notes } = req.body;
    const updatedBy = req.user.userId;

    const agenda = await closingMeetingService.updateAgendaDiscussed(
      agendaId, 
      discussed, 
      notes, 
      updatedBy
    );
    
    res.status(200).json({ 
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

    const meeting = await closingMeetingService.updateMeetingNotes(meetingId, notes, updatedBy);
    
    res.status(200).json({ 
      message: 'Meeting notes updated successfully', 
      meeting 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Start a closing meeting
 */
const startMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const startedBy = req.user.userId;

    const meeting = await closingMeetingService.startMeeting(meetingId, startedBy);
    
    res.status(200).json({ 
      message: 'Closing meeting started successfully', 
      meeting 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete a closing meeting
 */
const completeMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const completedBy = req.user.userId;

    const meeting = await closingMeetingService.completeMeeting(meetingId, completedBy);
    
    res.status(200).json({ 
      message: 'Closing meeting completed successfully', 
      meeting 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Archive a closing meeting
 */
const archiveMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const archivedBy = req.user.userId;

    const meeting = await closingMeetingService.archiveMeeting(meetingId, archivedBy);
    
    res.status(200).json({ 
      message: 'Closing meeting archived successfully', 
      meeting 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get closing meeting attendees
 */
const getClosingMeetingAttendees = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const tenantId = req.user.tenantId;

    const attendees = await closingMeetingService.getClosingMeetingAttendees(auditId, tenantId);
    
    res.status(200).json({ 
      message: 'Closing meeting attendees retrieved successfully', 
      attendees 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createClosingMeeting,
  getClosingMeetingById,
  getClosingMeetingByAudit,
  updateAttendance,
  updateAgendaDiscussed,
  updateMeetingNotes,
  startMeeting,
  completeMeeting,
  archiveMeeting,
  getClosingMeetingAttendees
}; 