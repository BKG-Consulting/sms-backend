// --- AUDIT PLAN PDF GENERATION & RETRIEVAL ---
const auditPlanPdfService = require('../services/auditPlanPdfService');
const { logger: pdfLogger } = require('../utils/logger');

const generateAuditPlanPdf = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { userId, tenantId } = req.user;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const result = await auditPlanPdfService.generateAuditPlanPdf(auditId, tenantId, userId);
    pdfLogger.info('Audit plan PDF generated successfully', { auditId, userId, tenantId });
    res.status(200).json(result);
  } catch (error) {
    pdfLogger.error('Error generating audit plan PDF:', error);
    next(error);
  }
};

const getAllAuditPlanPdfs = async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { prisma } = require('../../prisma/client');

    const auditPlanDocuments = await prisma.document.findMany({
      where: {
        tenantId,
        type: 'AUDIT_PLAN'
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
        },
        audit: {
          select: {
            id: true,
            auditNo: true,
            type: true,
            auditProgram: {
              select: {
                title: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const plans = auditPlanDocuments.map(doc => ({
      id: doc.id,
      auditId: doc.auditId,
      auditNo: doc.audit?.auditNo,
      auditTitle: doc.audit?.auditProgram?.title,
      auditType: doc.audit?.type,
      status: doc.status,
      generatedAt: doc.createdAt,
      generatedBy: `${doc.owner?.firstName || ''} ${doc.owner?.lastName || ''}`.trim() || 'Unknown',
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
    }));

    pdfLogger.info('Audit plan PDFs retrieved successfully', { tenantId, count: plans.length });
    res.status(200).json({
      message: 'Audit plan PDFs retrieved successfully',
      plans
    });
  } catch (error) {
    pdfLogger.error('Error fetching audit plan PDFs:', error);
    next(error);
  }
};
const auditService = require('../services/auditService');
const { logger } = require('../utils/logger.util');
const { prisma } = require('../../prisma/client');

const createAudit = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const createdBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const audit = await auditService.createAudit({
      ...req.body,
      tenantId,
      createdBy
    });

    logger.info('Audit created via API', {
      auditId: audit.id,
      auditNo: audit.auditNo,
      type: audit.type,
      auditProgramId: audit.auditProgramId,
      tenantId,
      createdBy
    });

    res.status(201).json({
      message: 'Audit created successfully',
      audit
    });
  } catch (error) {
    next(error);
  }
};
const getPlanningMeetingFullDetails = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const meeting = await auditService.getPlanningMeetingFullDetails(meetingId);
    res.json({ message: 'Planning meeting full details fetched', meeting });
  } catch (error) {
    next(error);
  }
};
const getAuditsByProgram = async (req, res, next) => {
  try {
    const { programId } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const audits = await auditService.getAuditsByProgram(programId, tenantId);

    logger.info('Audits fetched via API', {
      programId,
      tenantId,
      count: audits.length
    });

    res.json({
      message: 'Audits fetched successfully',
      audits,
      count: audits.length
    });
  } catch (error) {
    next(error);
  }
};

const getAuditById = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const audit = await auditService.getAuditById(auditId, tenantId);

    logger.info('Audit fetched via API', {
      auditId,
      tenantId
    });

    res.json({
      message: 'Audit fetched successfully',
      audit
    });
  } catch (error) {
    next(error);
  }
};

const updateAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const updates = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const audit = await auditService.updateAudit({
      auditId,
      updates,
      tenantId,
      updatedBy
    });

    logger.info('Audit updated via API', {
      auditId,
      tenantId,
      updatedBy,
      updates
    });

    res.json({
      message: 'Audit updated successfully',
      audit
    });
  } catch (error) {
    next(error);
  }
};

const deleteAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const tenantId = req.user.tenantId;
    const deletedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    await auditService.deleteAudit({
      auditId,
      tenantId,
      deletedBy
    });

    logger.info('Audit deleted via API', {
      auditId,
      tenantId,
      deletedBy
    });

    res.json({
      message: 'Audit deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const addOrUpdateTeamMember = async (req, res, next) => {
    try {
        const { auditId, userId } = req.params;
        const { role } = req.body;
        const tenantId = req.user.tenantId;
        const updatedBy = req.user.userId;

        if (!tenantId) {
            return res.status(400).json({ message: 'Tenant ID not found' });
        }
        if (!role) {
            return res.status(400).json({ message: 'Role is required' });
        }

        const teamMember = await auditService.addOrUpdateTeamMember({
            auditId,
            userId,
            role,
            tenantId,
            updatedBy
        });

        res.json({
            message: 'Team member updated successfully',
            teamMember
        });

    } catch (error) {
        next(error);
    }
};

const removeTeamMember = async (req, res, next) => {
    try {
        const { auditId, userId } = req.params;
        const tenantId = req.user.tenantId;
        const removedBy = req.user.userId;

        if (!tenantId) {
            return res.status(400).json({ message: 'Tenant ID not found' });
        }

        await auditService.removeTeamMember({
            auditId,
            userId,
            tenantId,
            removedBy
        });

        res.json({ message: 'Team member removed successfully' });

    } catch (error) {
        next(error);
    }
};

const respondToTeamAppointment = async (req, res, next) => {
    try {
        const { auditId, userId } = req.params;
        const { status, declineReason } = req.body;
        const responderId = req.user.userId;
        const tenantId = req.user.tenantId;

        if (!tenantId) {
            return res.status(400).json({ message: 'Tenant ID not found' });
        }
        if (responderId !== userId) {
            return res.status(403).json({ message: 'You can only respond to your own appointment.' });
        }
        if (!['ACCEPTED', 'DECLINED'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status. Must be ACCEPTED or DECLINED.' });
        }

        const teamMember = await auditService.respondToTeamAppointment({
            auditId,
            userId,
            status,
            declineReason,
            tenantId,
            responderId
        });

        res.json({
            message: 'Appointment response recorded successfully',
            teamMember
        });
    } catch (error) {
        next(error);
    }
};

const getEligibleTeamMembers = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const tenantId = req.user.tenantId;
    const eligibleUsers = await auditService.getEligibleTeamMembers(auditId, tenantId);
    res.json({ users: eligibleUsers });
  } catch (error) {
    next(error);
  }
};

const getEligibleTeamLeaders = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const tenantId = req.user.tenantId;
    const eligibleUsers = await auditService.getEligibleTeamLeaders(auditId, tenantId);
    res.json({ users: eligibleUsers });
  } catch (error) {
    next(error);
  }
};

const assignTeamLeader = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { teamLeaderId } = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }
    if (!teamLeaderId) {
      return res.status(400).json({ message: 'teamLeaderId is required' });
    }

    const audit = await auditService.assignTeamLeader({ auditId, teamLeaderId, tenantId, updatedBy });
    res.json({ message: 'Team leader assigned successfully', audit });
  } catch (error) {
    next(error);
  }
};

const addTeamMember = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    let { userIds, userId } = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;
    // Support both single and multiple userIds for backward compatibility
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID not found' });
    if (!userIds && !userId) return res.status(400).json({ message: 'userIds or userId is required' });
    if (!userIds) userIds = [userId];
    if (!Array.isArray(userIds)) userIds = [userIds];
    const result = await auditService.addTeamMembers({ auditId, userIds, tenantId, updatedBy });
    res.json({ message: 'Team members added successfully', ...result });
  } catch (error) {
    next(error);
  }
};

const sendGeneralAuditNotification = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }
    // Frontend gates this action by permission matrix; backend enforces only eligibility and auth
    const result = await auditService.sendGeneralAuditNotification({ auditId, userId, tenantId });
    logger.info('General Audit Notification sent', { auditId, userId, tenantId });
    res.json({ message: 'General Audit Notification sent successfully', ...result });
  } catch (error) {
    next(error);
  }
};

// Check if a general audit notification can be sent
const checkNotificationEligibility = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const eligibility = await auditService.canSendGeneralAuditNotification({ auditId, tenantId });
    
    res.json({
      success: true,
      eligibility
    });
  } catch (error) {
    next(error);
  }
};

// Get notification status for an audit
const getNotificationStatus = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const tenantId = req.user.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const status = await auditService.getGeneralAuditNotificationStatus({ auditId, tenantId });
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    next(error);
  }
};

// --- AUDIT PLANNING MEETING CONTROLLERS ---

const createPlanningMeeting = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { scheduledAtLocal, timeZone, scheduledAt, notes, type, inviteeIds, venue, agendas, attendance } = req.body;
    const createdById = req.user.userId;
    
    // Check if meeting already exists to determine response
    const existing = await prisma.planningMeeting.findFirst({
      where: { auditId, archived: false }
    });
    
    const meeting = await auditService.createPlanningMeeting({
      auditId,
      scheduledAtLocal,
      timeZone,
      scheduledAt,
      createdById,
      notes,
      type,
      inviteeIds, // pass through
      venue,      // pass through
      agendas,    // pass through
      attendance  // pass through
    });
    
    // Return appropriate response based on whether meeting was created or updated
    if (existing) {
      res.status(200).json({
        message: 'Planning meeting updated successfully',
        meeting,
        action: 'updated'
      });
    } else {
      res.status(201).json({
        message: 'Planning meeting created successfully',
        meeting,
        action: 'created'
      });
    }
  } catch (error) {
    next(error);
  }
};

const getPlanningMeetingById = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const meeting = await auditService.getPlanningMeetingById(meetingId);
    res.json({ message: 'Planning meeting fetched', meeting });
  } catch (error) {
    next(error);
  }
};

const getPlanningMeetingsByAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { type } = req.query;
    const meetings = await auditService.getPlanningMeetingsByAudit(auditId, type);
    res.json({ message: 'Planning meetings fetched', meetings });
  } catch (error) {
    next(error);
  }
};

const updatePlanningMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const updates = req.body;
    const meeting = await auditService.updatePlanningMeeting(meetingId, updates);
    res.json({ message: 'Planning meeting updated', meeting });
  } catch (error) {
    next(error);
  }
};

const deletePlanningMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    await auditService.deletePlanningMeeting(meetingId);
    res.json({ message: 'Planning meeting archived' });
  } catch (error) {
    next(error);
  }
};

// NEW: Batch update planning meeting
const batchUpdatePlanningMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { attendanceUpdates, agendaUpdates, notesUpdate, statusUpdate } = req.body;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const result = await auditService.batchUpdatePlanningMeeting({
      meetingId,
      attendanceUpdates,
      agendaUpdates,
      notesUpdate,
      statusUpdate,
      userId,
      tenantId
    });

    res.json({ 
      message: 'Planning meeting updated successfully', 
      result 
    });
  } catch (error) {
    next(error);
  }
};

const addOrUpdateAttendance = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { userId, present, remarks } = req.body;
    const attendance = await auditService.addOrUpdateAttendance({ meetingId, userId, present, remarks });
    res.json({ message: 'Attendance recorded', attendance });
  } catch (error) {
    next(error);
  }
};

const getAttendancesByMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const attendances = await auditService.getAttendancesByMeeting(meetingId);
    res.json({ message: 'Attendances fetched', attendances });
  } catch (error) {
    next(error);
  }
};

const addAgendaItem = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { agendaText, order } = req.body;
    const agenda = await auditService.addAgendaItem({ meetingId, agendaText, order });
    res.status(201).json({ message: 'Agenda item added', agenda });
  } catch (error) {
    next(error);
  }
};

const getAgendasByMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const agendas = await auditService.getAgendasByMeeting(meetingId);
    res.json({ message: 'Agendas fetched', agendas });
  } catch (error) {
    next(error);
  }
};

const deleteAgendaItem = async (req, res, next) => {
  try {
    const { agendaId } = req.params;
    await auditService.deleteAgendaItem(agendaId);
    res.json({ message: 'Agenda item deleted' });
  } catch (error) {
    next(error);
  }
};

// --- AUDIT EXECUTION PHASE CONTROLLERS ---

const createAuditPlan = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const {
      title, description, objectives, scope, criteria, methods,
      plannedStartDate, plannedEndDate, timetable, notes, requirements
    } = req.body;
    const createdById = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const auditPlan = await auditService.createAuditPlan({
      auditId,
      title,
      description,
      objectives,
      scope,
      criteria,
      methods,
      plannedStartDate,
      plannedEndDate,
      timetable,
      notes,
      requirements,
      createdById
    });

    res.status(201).json({ message: 'Audit plan created successfully', auditPlan });
  } catch (error) {
    next(error);
  }
};

const getAuditPlansByAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const auditPlans = await auditService.getAuditPlansByAudit(auditId, tenantId);
    res.json({ message: 'Audit plans fetched successfully', auditPlans });
  } catch (error) {
    next(error);
  }
};

const getAuditPlanById = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const auditPlan = await auditService.getAuditPlanById(planId, tenantId);
    res.json({ message: 'Audit plan fetched successfully', auditPlan });
  } catch (error) {
    next(error);
  }
};

const updateAuditPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const updates = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const auditPlan = await auditService.updateAuditPlan({
      planId,
      updates,
      tenantId,
      updatedBy
    });

    res.json({ message: 'Audit plan updated successfully', auditPlan });
  } catch (error) {
    next(error);
  }
};

const createNonConformity = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { findingId, title, description, clauseNumber, type, severity, rootCause } = req.body;
    const createdById = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const nonConformity = await auditService.createNonConformity({
      planId,
      findingId,
      title,
      description,
      clauseNumber,
      type,
      severity,
      rootCause,
      createdById
    });

    res.status(201).json({ message: 'Non-conformity created successfully', nonConformity });
  } catch (error) {
    next(error);
  }
};

const createCorrectiveAction = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { nonConformityId, title, description, actionType, priority, dueDate, assignedToId } = req.body;
    const createdById = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const correctiveAction = await auditService.createCorrectiveAction({
      planId,
      nonConformityId,
      title,
      description,
      actionType,
      priority,
      dueDate,
      assignedToId,
      createdById
    });

    res.status(201).json({ message: 'Corrective action created successfully', correctiveAction });
  } catch (error) {
    next(error);
  }
};

const updateCorrectiveAction = async (req, res, next) => {
  try {
    const { actionId } = req.params;
    const updates = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const correctiveAction = await auditService.updateCorrectiveAction({
      actionId,
      updates,
      tenantId,
      updatedBy
    });

    res.json({ message: 'Corrective action updated successfully', correctiveAction });
  } catch (error) {
    next(error);
  }
};

// --- AUDIT CHECKLIST CONTROLLERS ---

const createChecklist = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { title, description, type, department, activityId } = req.body;
    const createdById = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const checklist = await auditService.createChecklist({
      planId,
      title,
      description,
      type,
      department,
      createdById,
      activityId
    });

    res.status(201).json({ message: 'Checklist created successfully', checklist });
  } catch (error) {
    next(error);
  }
};

const getChecklistsByPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const checklists = await auditService.getChecklistsByPlan(planId, tenantId);
    res.json({ message: 'Checklists fetched successfully', checklists });
  } catch (error) {
    next(error);
  }
};

const getChecklistById = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const checklist = await auditService.getChecklistById(checklistId, tenantId);
    res.json({ message: 'Checklist fetched successfully', checklist });
  } catch (error) {
    next(error);
  }
};

const updateChecklist = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const updates = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const checklist = await auditService.updateChecklist({
      checklistId,
      updates,
      tenantId,
      updatedBy
    });

    res.json({ message: 'Checklist updated successfully', checklist });
  } catch (error) {
    next(error);
  }
};

const deleteChecklist = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const tenantId = req.user.tenantId;
    const deletedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    await auditService.deleteChecklist({
      checklistId,
      tenantId,
      deletedBy
    });

    res.json({ message: 'Checklist deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const addChecklistItem = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const { title, description, clauseNumber, isRequired, order } = req.body;
    const createdById = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const checklistItem = await auditService.addChecklistItem({
      checklistId,
      title,
      description,
      clauseNumber,
      isRequired,
      order,
      createdById
    });

    res.status(201).json({ message: 'Checklist item added successfully', checklistItem });
  } catch (error) {
    next(error);
  }
};

const updateChecklistItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const updates = req.body;
    const tenantId = req.user.tenantId;
    const updatedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const checklistItem = await auditService.updateChecklistItem({
      itemId,
      updates,
      tenantId,
      updatedBy
    });

    res.json({ message: 'Checklist item updated successfully', checklistItem });
  } catch (error) {
    next(error);
  }
};

const completeChecklistItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const { completed, notes, evidence, attachments } = req.body;
    const completedById = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const checklistItem = await auditService.completeChecklistItem({
      itemId,
      completed,
      notes,
      evidence,
      attachments,
      completedById,
      tenantId
    });

    res.json({ message: 'Checklist item completion updated successfully', checklistItem });
  } catch (error) {
    next(error);
  }
};

const deleteChecklistItem = async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const tenantId = req.user.tenantId;
    const deletedBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    await auditService.deleteChecklistItem({
      itemId,
      tenantId,
      deletedBy
    });

    res.json({ message: 'Checklist item deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const getChecklistProgress = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const progress = await auditService.getChecklistProgress(checklistId, tenantId);
    res.json({ message: 'Checklist progress fetched successfully', progress });
  } catch (error) {
    next(error);
  }
};

// --- MEETING STATUS MANAGEMENT CONTROLLERS ---

const startPlanningMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const meeting = await auditService.startPlanningMeeting({ meetingId, userId, tenantId });
    res.json({ message: 'Meeting started successfully', meeting });
  } catch (error) {
    next(error);
  }
};

const completePlanningMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const meeting = await auditService.completePlanningMeeting({ meetingId, userId, tenantId });
    res.json({ message: 'Meeting completed successfully', meeting });
  } catch (error) {
    next(error);
  }
};

const joinPlanningMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }

    const meeting = await auditService.joinPlanningMeeting({ meetingId, userId, tenantId });
    res.json({ message: 'Joined meeting successfully', meeting });
  } catch (error) {
    next(error);
  }
};

// --- AUDIT PLAN APPROVAL WORKFLOW ---
const submitAuditPlanForApproval = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID not found' });
    const result = await auditService.submitAuditPlanForApproval({ planId, userId, tenantId });
    res.json({ message: 'Audit plan submitted for approval', ...result });
  } catch (error) { next(error); }
};

const approveAuditPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID not found' });
    const result = await auditService.approveAuditPlan({ planId, userId, tenantId });
    res.json({ message: 'Audit plan approved', ...result });
  } catch (error) { next(error); }
};

const rejectAuditPlan = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;
    const { reason } = req.body;
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID not found' });
    const result = await auditService.rejectAuditPlan({ planId, userId, tenantId, reason });
    res.json({ message: 'Audit plan rejected', ...result });
  } catch (error) { next(error); }
};

const createChecklistWithItems = async (req, res, next) => {
  try {
    const { planId } = req.params;
    const { title, description, type, department, items, assigneeIds } = req.body;
    const createdById = req.user.userId;
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Checklist items are required' });
    }
    if (!Array.isArray(assigneeIds) || assigneeIds.length === 0) {
      return res.status(400).json({ message: 'Checklist assignees are required' });
    }

    const checklist = await auditService.createChecklistWithItems({
      planId,
      title,
      description,
      type,
      department,
      items,
      assigneeIds,
      createdById
    });

    res.status(201).json({ message: 'Checklist with items created successfully', checklist });
  } catch (error) {
    next(error);
  }
};

// New: Update checklist with items and assignees in one request
const updateChecklistWithItemsAndAssignees = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const { title, description, type, department, assigneeIds, items } = req.body;
    const updatedBy = req.user.userId;
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID not found' });
    }
    const checklist = await auditService.updateChecklistWithItemsAndAssignees({
      checklistId,
      title,
      description,
      type,
      department,
      assigneeIds,
      items,
      updatedBy,
      tenantId
    });
    res.json({ message: 'Checklist updated successfully', checklist });
  } catch (error) {
    next(error);
  }
};

const hardDeletePlanningMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    await auditService.hardDeletePlanningMeeting(meetingId);
    res.json({ message: 'Planning meeting permanently deleted' });
  } catch (error) {
    next(error);
  }
};

// Get the first planning meeting of type 'PLANNING' for a given audit
const getPlanningMeetingForAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    console.log('🔍 Backend: getPlanningMeetingForAudit called with auditId:', auditId);
    
    // Only fetch meetings of type 'PLANNING'
    const meetings = await auditService.getPlanningMeetingsByAudit(auditId, 'PLANNING');
    console.log('🔍 Backend: Found meetings:', meetings.length);
    
    if (meetings.length > 0) {
      console.log('🔍 Backend: First meeting auditId:', meetings[0].auditId);
      console.log('🔍 Backend: Expected auditId:', auditId);
      
      if (meetings[0].auditId !== auditId) {
        console.error('🚨 Backend MISMATCH: Meeting belongs to different audit!');
        console.error('Expected auditId:', auditId);
        console.error('Meeting auditId:', meetings[0].auditId);
      }
    }
    
    res.json({ meeting: meetings[0] || null });
  } catch (error) {
    next(error);
  }
};

const updateAgendaDiscussed = async (req, res, next) => {
  try {
    const { agendaId } = req.params;
    const { discussed } = req.body;
    const updated = await prisma.auditPlanningAgenda.update({
      where: { id: agendaId },
      data: { discussed: !!discussed }
    });
    res.json({ message: 'Agenda updated', agenda: updated });
  } catch (error) {
    next(error);
  }
};

const updateAttendancePresent = async (req, res, next) => {
  try {
    const { attendanceId } = req.params;
    const { present } = req.body;
    const updated = await prisma.auditPlanningAttendance.update({
      where: { id: attendanceId },
      data: { present: !!present, remarks: present ? 'Present' : 'Absent' }
    });
    res.json({ message: 'Attendance updated', attendance: updated });
  } catch (error) {
    next(error);
  }
};

// Management Review Meeting Controllers
const createManagementReviewMeeting = async (req, res, next) => {
  try {
    const { auditId, notes } = req.body;
    const userId = req.user.userId;
    const tenantId = req.user.tenantId;

    const result = await auditService.createManagementReviewMeeting(auditId, {
      notes,
      createdBy: userId,
      tenantId
    });

    res.status(201).json({
      success: true,
      message: 'Management review meeting created successfully',
      meeting: result.meeting
    });
  } catch (error) {
    next(error);
  }
};

const getManagementReviewMeetingForAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const tenantId = req.user.tenantId;

    const result = await auditService.getManagementReviewMeetingForAudit(auditId, tenantId);

    res.status(200).json({
      success: true,
      meeting: result.meeting
    });
  } catch (error) {
    next(error);
  }
};

const updateManagementReviewMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { notes } = req.body;
    const tenantId = req.user.tenantId;

    const result = await auditService.updateManagementReviewMeeting(meetingId, {
      notes
    }, tenantId);

    res.status(200).json({
      success: true,
      message: 'Management review meeting updated successfully',
      meeting: result.meeting
    });
  } catch (error) {
    next(error);
  }
};

const deleteManagementReviewMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const tenantId = req.user.tenantId;

    await auditService.deleteManagementReviewMeeting(meetingId, tenantId);

    res.status(200).json({
      success: true,
      message: 'Management review meeting deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const createMinuteItem = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { title, order, notes } = req.body;
    const tenantId = req.user.tenantId;

    const result = await auditService.createMinuteItem(meetingId, {
      title,
      order,
      notes
    }, tenantId);

    res.status(201).json({
      success: true,
      message: 'Minute item created successfully',
      minute: result.minute
    });
  } catch (error) {
    next(error);
  }
};

const updateMinuteItem = async (req, res, next) => {
  try {
    const { minuteId } = req.params;
    const { notes } = req.body;
    const tenantId = req.user.tenantId;

    const result = await auditService.updateMinuteItem(minuteId, {
      notes
    }, tenantId);

    res.status(200).json({
      success: true,
      message: 'Minute item updated successfully',
      minute: result.minute
    });
  } catch (error) {
    next(error);
  }
};

const deleteMinuteItem = async (req, res, next) => {
  try {
    const { minuteId } = req.params;
    const tenantId = req.user.tenantId;

    await auditService.deleteMinuteItem(minuteId, tenantId);

    res.status(200).json({
      success: true,
      message: 'Minute item deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

const createAttendance = async (req, res, next) => {
  try {
    const { meetingId } = req.params;
    const { userId, present } = req.body;
    const tenantId = req.user.tenantId;

    const result = await auditService.createAttendance(meetingId, userId, present, tenantId);

    res.status(201).json({
      success: true,
      message: 'Attendance record created successfully',
      attendance: result.attendance
    });
  } catch (error) {
    next(error);
  }
};

const updateAttendance = async (req, res, next) => {
  try {
    const { meetingId, userId } = req.params;
    const { present } = req.body;
    const tenantId = req.user.tenantId;

    const result = await auditService.updateAttendance(meetingId, userId, present, tenantId);

    res.status(200).json({
      success: true,
      message: 'Attendance record updated successfully',
      attendance: result.attendance
    });
  } catch (error) {
    next(error);
  }
};



module.exports = {
  createAudit,
  getAuditsByProgram,
  getAuditById,
  updateAudit,
  deleteAudit,
  addOrUpdateTeamMember,
  removeTeamMember,
  respondToTeamAppointment,
  getEligibleTeamMembers,
  getEligibleTeamLeaders,
  assignTeamLeader,
  addTeamMember,
  sendGeneralAuditNotification,
  checkNotificationEligibility,
  getNotificationStatus,
  createPlanningMeeting,
  getPlanningMeetingById,
  getPlanningMeetingsByAudit,
  updatePlanningMeeting,
  deletePlanningMeeting,
  addOrUpdateAttendance,
  getAttendancesByMeeting,
  addAgendaItem,
  getAgendasByMeeting,
  deleteAgendaItem,
  createAuditPlan,
  getAuditPlansByAudit,
  getAuditPlanById,
  updateAuditPlan,
  createNonConformity,
  createCorrectiveAction,
  updateCorrectiveAction,
  createChecklist,
  getChecklistsByPlan,
  getChecklistById,
  updateChecklist,
  deleteChecklist,
  addChecklistItem,
  updateChecklistItem,
  completeChecklistItem,
  deleteChecklistItem,
  getChecklistProgress,
  startPlanningMeeting,
  completePlanningMeeting,
  joinPlanningMeeting,
  submitAuditPlanForApproval,
  approveAuditPlan,
  rejectAuditPlan,
  createChecklistWithItems,
  updateChecklistWithItemsAndAssignees,
  getPlanningMeetingFullDetails,
  batchUpdatePlanningMeeting,
  hardDeletePlanningMeeting,
  getPlanningMeetingForAudit,
  updateAgendaDiscussed,
  updateAttendancePresent,
  generateAuditPlanPdf,
  getAllAuditPlanPdfs,
  sendGeneralAuditNotification,
  checkNotificationEligibility,
  getNotificationStatus,
  createManagementReviewMeeting,
  getManagementReviewMeetingForAudit,
  updateManagementReviewMeeting,
  deleteManagementReviewMeeting,
  createMinuteItem,
  updateMinuteItem,
  deleteMinuteItem,
  createAttendance,
  updateAttendance
};