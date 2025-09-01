const express = require('express');
const { authenticateToken, requirePermission } = require('../middleware/authMiddleware');
const auditController = require('../controllers/auditController');
const openingMeetingController = require('../controllers/openingMeetingController');
const closingMeetingController = require('../controllers/closingMeetingController');
const optimizedMeetingController = require('../controllers/optimizedMeetingController');
const agendaTemplateController = require('../controllers/agendaTemplateController');
const meetingController = require('../controllers/meetingController');
const auditTeamRoutes = require('./auditTeamRoutes');
const checklistController = require('../controllers/checklistController');
const { prisma } = require('../../prisma/client');
const logger = require('../utils/logger');

const router = express.Router();

// Create new audit
router.post('/', authenticateToken, auditController.createAudit);

// Get audits by program
router.get('/program/:programId', authenticateToken, auditController.getAuditsByProgram);

// --- Unified Meetings Endpoint (for frontend compatibility) ---
router.get('/all-meetings', authenticateToken, meetingController.getUserMeetings);

// Get specific audit
router.get('/:auditId', authenticateToken, auditController.getAuditById);

// Update audit
router.put('/:auditId', authenticateToken, auditController.updateAudit);

// Delete audit
router.delete('/:auditId', authenticateToken, auditController.deleteAudit);

// Get eligible team members for an audit
router.get('/:auditId/eligible-team-members', authenticateToken, auditController.getEligibleTeamMembers);

// Get eligible team leaders for an audit
router.get('/:auditId/eligible-team-leaders', authenticateToken, auditController.getEligibleTeamLeaders);

// Assign team leader to audit
router.patch('/:auditId/assign-team-leader', authenticateToken, auditController.assignTeamLeader);

// Add team member to audit
router.post('/:auditId/team-members', authenticateToken, auditController.addTeamMember);

// Mount team member sub-routes (remove, update, respond)
router.use('/:auditId/team-members', auditTeamRoutes);

// General Audit Notification routes (permission-based)
router.post('/:auditId/general-notification', authenticateToken, auditController.sendGeneralAuditNotification);
router.get('/:auditId/notification-eligibility', authenticateToken, auditController.checkNotificationEligibility);
router.get('/:auditId/notification-status', authenticateToken, auditController.getNotificationStatus);

// --- Planning Meeting Endpoints ---
router.post('/:auditId/planning-meetings', authenticateToken, async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { notes, attendance, agendas } = req.body;
    const { userId, tenantId } = req.user;

    // Verify audit exists and user has access
    const audit = await prisma.audit.findFirst({
      where: {
        id: auditId,
        auditProgram: { tenantId }
      }
    });

    if (!audit) {
      return res.status(404).json({
        message: 'Audit not found',
        error: 'Audit not found'
      });
    }

    // Create planning meeting with all data in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the planning meeting
      const meeting = await tx.planningMeeting.create({
        data: {
          auditId,
          createdById: userId,
          notes: notes || '',
          status: 'ACTIVE'
        }
      });

      // Create attendances
      if (attendance && attendance.length > 0) {
        await tx.planningMeetingAttendance.createMany({
          data: attendance.map((att) => ({
            meetingId: meeting.id,
            userId: att.userId,
            present: att.present,
            remarks: att.remarks || null
          }))
        });
      }

      // Create agendas
      if (agendas && agendas.length > 0) {
        await tx.planningMeetingAgenda.createMany({
          data: agendas.map((agenda, index) => ({
            meetingId: meeting.id,
            agendaText: agenda.agendaText,
            order: agenda.order || index + 1,
            discussed: agenda.discussed || false,
            notes: agenda.notes || null
          }))
        });
      }

      // Return the created meeting with all related data
      return await tx.planningMeeting.findUnique({
        where: { id: meeting.id },
        include: {
          attendances: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          agendas: {
            orderBy: { order: 'asc' }
          },
          audit: {
            select: {
              id: true,
              auditNo: true,
              auditProgram: {
                select: {
                  id: true,
                  title: true
                }
              }
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });
    });

    res.status(201).json({
      message: 'Planning meeting created successfully',
      meeting: result
    });

  } catch (error) {
    logger.error('Error creating planning meeting:', error);
    next(error);
  }
});
router.get('/planning-meetings/:meetingId', authenticateToken, auditController.getPlanningMeetingById);
router.put('/planning-meetings/:meetingId', authenticateToken, auditController.updatePlanningMeeting);
router.delete('/planning-meetings/:meetingId', authenticateToken, auditController.deletePlanningMeeting);
router.get('/:auditId/planning-meeting', authenticateToken, auditController.getPlanningMeetingForAudit);

// Batch update
router.put('/planning-meetings/:meetingId/batch', authenticateToken, auditController.batchUpdatePlanningMeeting);

// Meeting Status
router.patch('/planning-meetings/:meetingId/start', authenticateToken, auditController.startPlanningMeeting);
router.patch('/planning-meetings/:meetingId/complete', authenticateToken, auditController.completePlanningMeeting);
router.patch('/planning-meetings/:meetingId/join', authenticateToken, auditController.joinPlanningMeeting);
router.get('/planning-meetings/:meetingId/full', authenticateToken, auditController.getPlanningMeetingFullDetails);

// Attendance
router.post('/planning-meetings/:meetingId/attendance', authenticateToken, auditController.addOrUpdateAttendance);
router.get('/planning-meetings/:meetingId/attendance', authenticateToken, auditController.getAttendancesByMeeting);
router.put('/planning-meetings/attendance/:attendanceId', authenticateToken, auditController.updateAttendancePresent);

// Agenda
router.post('/planning-meetings/:meetingId/agenda', authenticateToken, auditController.addAgendaItem);
router.get('/planning-meetings/:meetingId/agenda', authenticateToken, auditController.getAgendasByMeeting);
router.delete('/planning-meetings/agenda/:agendaId', authenticateToken, auditController.deleteAgendaItem);
router.put('/planning-meetings/agenda/:agendaId', authenticateToken, auditController.updateAgendaDiscussed);
router.delete('/planning-meetings/:meetingId/hard', authenticateToken, auditController.hardDeletePlanningMeeting);

// --- Opening Meeting Endpoints ---
router.post('/:auditId/opening-meetings', authenticateToken, openingMeetingController.createOpeningMeeting);
router.post('/:auditId/opening-meetings/batch', authenticateToken, optimizedMeetingController.createOpeningMeetingWithData);
router.post('/:auditId/opening-meetings/user-driven', authenticateToken, optimizedMeetingController.createOpeningMeetingUserDriven);
router.get('/:auditId/opening-meetings/default-agendas', authenticateToken, optimizedMeetingController.getDefaultOpeningAgendas);
router.get('/:auditId/opening-meeting', authenticateToken, openingMeetingController.getOpeningMeetingByAudit);
router.get('/opening-meetings/:meetingId', authenticateToken, openingMeetingController.getOpeningMeetingById);
router.get('/:auditId/opening-meeting/attendees', authenticateToken, openingMeetingController.getOpeningMeetingAttendees);
router.post('/opening-meetings/:meetingId/attendance', authenticateToken, openingMeetingController.updateAttendance);
router.put('/opening-meetings/:meetingId/batch', authenticateToken, optimizedMeetingController.batchUpdateOpeningMeeting);
router.put('/opening-meetings/agenda/:agendaId', authenticateToken, openingMeetingController.updateAgendaDiscussed);
router.put('/opening-meetings/:meetingId/notes', authenticateToken, openingMeetingController.updateMeetingNotes);
router.patch('/opening-meetings/:meetingId/start', authenticateToken, openingMeetingController.startMeeting);
router.patch('/opening-meetings/:meetingId/complete', authenticateToken, openingMeetingController.completeMeeting);
router.delete('/opening-meetings/:meetingId', authenticateToken, openingMeetingController.archiveMeeting);

// --- Closing Meeting Endpoints ---
router.post('/:auditId/closing-meetings', authenticateToken, closingMeetingController.createClosingMeeting);
router.post('/:auditId/closing-meetings/batch', authenticateToken, optimizedMeetingController.createClosingMeetingWithData);
router.post('/:auditId/closing-meetings/user-driven', authenticateToken, optimizedMeetingController.createClosingMeetingUserDriven);
router.get('/:auditId/closing-meetings/default-agendas', authenticateToken, optimizedMeetingController.getDefaultClosingAgendas);
router.get('/:auditId/closing-meeting', authenticateToken, closingMeetingController.getClosingMeetingByAudit);
router.get('/closing-meetings/:meetingId', authenticateToken, closingMeetingController.getClosingMeetingById);
router.get('/:auditId/closing-meeting/attendees', authenticateToken, closingMeetingController.getClosingMeetingAttendees);
router.post('/closing-meetings/:meetingId/attendance', authenticateToken, closingMeetingController.updateAttendance);
router.put('/closing-meetings/:meetingId/batch', authenticateToken, optimizedMeetingController.batchUpdateClosingMeeting);
router.put('/closing-meetings/agenda/:agendaId', authenticateToken, closingMeetingController.updateAgendaDiscussed);
router.put('/closing-meetings/:meetingId/notes', authenticateToken, closingMeetingController.updateMeetingNotes);
router.patch('/closing-meetings/:meetingId/start', authenticateToken, closingMeetingController.startMeeting);
router.patch('/closing-meetings/:meetingId/complete', authenticateToken, closingMeetingController.completeMeeting);
router.delete('/closing-meetings/:meetingId', authenticateToken, closingMeetingController.archiveMeeting);

// --- Management Review Meeting Endpoints ---
router.post('/management-review-meetings', authenticateToken, auditController.createManagementReviewMeeting);
router.get('/management-review-meetings/:auditId', authenticateToken, auditController.getManagementReviewMeetingForAudit);
router.put('/management-review-meetings/:meetingId', authenticateToken, auditController.updateManagementReviewMeeting);
router.delete('/management-review-meetings/:meetingId', authenticateToken, auditController.deleteManagementReviewMeeting);

// Management Review Meeting Minutes routes
router.post('/management-review-meetings/:meetingId/minutes', authenticateToken, auditController.createMinuteItem);
router.put('/management-review-meetings/minutes/:minuteId', authenticateToken, auditController.updateMinuteItem);
router.delete('/management-review-meetings/minutes/:minuteId', authenticateToken, auditController.deleteMinuteItem);

// Management Review Meeting Attendance routes
router.post('/management-review-meetings/:meetingId/attendance', authenticateToken, auditController.createAttendance);
router.put('/management-review-meetings/:meetingId/attendance/:userId', authenticateToken, auditController.updateAttendance);

// --- Agenda Template Endpoints ---
router.get('/agenda-templates', authenticateToken, agendaTemplateController.getAllTemplates);
router.get('/agenda-templates/:type', authenticateToken, agendaTemplateController.getAgendaTemplate);
router.put('/agenda-templates/:type', authenticateToken, agendaTemplateController.upsertTemplate);
router.post('/agenda-templates/initialize', authenticateToken, agendaTemplateController.initializeDefaultTemplates);
router.delete('/agenda-templates/:templateId', authenticateToken, agendaTemplateController.deleteTemplate);

// --- Execution Phase: Audit Plans ---
router.post('/:auditId/plans', authenticateToken, auditController.createAuditPlan);
router.get('/:auditId/plans', authenticateToken, auditController.getAuditPlansByAudit);
router.get('/plans/:planId', authenticateToken, auditController.getAuditPlanById);
router.put('/plans/:planId', authenticateToken, auditController.updateAuditPlan);

// Non-Conformities
router.post('/plans/:planId/non-conformities', authenticateToken, auditController.createNonConformity);

// Corrective Actions
router.post('/plans/:planId/corrective-actions', authenticateToken, auditController.createCorrectiveAction);
router.put('/corrective-actions/:actionId', authenticateToken, auditController.updateCorrectiveAction);

// --- Checklists ---
router.post('/plans/:planId/checklists', authenticateToken, auditController.createChecklist);

router.get('/plans/:planId/checklists', authenticateToken, auditController.getChecklistsByPlan);
router.get('/checklists/:checklistId', authenticateToken, auditController.getChecklistById);
router.put('/checklists/:checklistId', authenticateToken, auditController.updateChecklist);
router.delete('/checklists/:checklistId', authenticateToken, auditController.deleteChecklist);

// --- Checklist Security Endpoints ---
router.get('/:auditId/checklists/user-scope/:userId', authenticateToken, checklistController.getUserChecklistScope);

// Checklist items
router.put('/checklists/:checklistId/full', authenticateToken, auditController.updateChecklistWithItemsAndAssignees);
router.post('/checklists/:checklistId/items', authenticateToken, auditController.addChecklistItem);
router.put('/checklist-items/:itemId', authenticateToken, auditController.updateChecklistItem);
router.patch('/checklist-items/:itemId/complete', authenticateToken, auditController.completeChecklistItem);
router.delete('/checklist-items/:itemId', authenticateToken, auditController.deleteChecklistItem);
router.get('/checklists/:checklistId/progress', authenticateToken, auditController.getChecklistProgress);

// --- Audit Plan Approval ---
router.post('/plans/:planId/submit', authenticateToken, auditController.submitAuditPlanForApproval);
router.post('/plans/:planId/approve', authenticateToken, auditController.approveAuditPlan);
router.post('/plans/:planId/reject', authenticateToken, auditController.rejectAuditPlan);

module.exports = router;
