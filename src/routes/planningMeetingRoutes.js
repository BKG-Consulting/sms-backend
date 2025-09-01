const express = require('express');
const router = express.Router();
const planningMeetingController = require('../controllers/planningMeetingController');
const { authenticateToken, requirePermission } = require('../middleware/authMiddleware');

// Apply authentication to all routes
router.use(authenticateToken);

// Basic CRUD operations
router.post('/:auditId', requirePermission('meeting', 'create'), planningMeetingController.createPlanningMeeting);
router.get('/:id', requirePermission('meeting', 'read'), planningMeetingController.getPlanningMeetingById);
router.get('/audit/:auditId', requirePermission('meeting', 'read'), planningMeetingController.getPlanningMeetingForAudit);
router.get('/audit/:auditId/all', requirePermission('meeting', 'read'), planningMeetingController.getPlanningMeetingsByAudit);
router.put('/:id', requirePermission('meeting', 'update'), planningMeetingController.updatePlanningMeeting);
router.delete('/:id', requirePermission('meeting', 'delete'), planningMeetingController.deletePlanningMeeting);
router.patch('/:id/archive', requirePermission('meeting', 'update'), planningMeetingController.archivePlanningMeeting);

// Meeting status management
router.patch('/:id/start', requirePermission('meeting', 'update'), planningMeetingController.startPlanningMeeting);
router.patch('/:id/complete', requirePermission('meeting', 'update'), planningMeetingController.completePlanningMeeting);
router.patch('/:id/cancel', requirePermission('meeting', 'update'), planningMeetingController.cancelPlanningMeeting);

// Batch operations
router.put('/:id/batch', requirePermission('meeting', 'update'), planningMeetingController.batchUpdateMeeting);

// Attendance management
router.post('/:meetingId/attendance', requirePermission('meeting', 'update'), planningMeetingController.addOrUpdateAttendance);
router.get('/:meetingId/attendance', requirePermission('meeting', 'read'), planningMeetingController.getAttendance);

// Agenda management
router.post('/:meetingId/agenda', requirePermission('meeting', 'update'), planningMeetingController.addAgendaItem);
router.put('/agenda/:id', requirePermission('meeting', 'update'), planningMeetingController.updateAgendaItem);
router.delete('/agenda/:id', requirePermission('meeting', 'update'), planningMeetingController.deleteAgendaItem);
router.get('/:meetingId/agenda', requirePermission('meeting', 'read'), planningMeetingController.getAgendaItems);

// Statistics
router.get('/stats/overview', requirePermission('meeting', 'read'), planningMeetingController.getPlanningMeetingStats);

module.exports = router; 