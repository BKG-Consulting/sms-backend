const checklistService = require('../services/checklistService');
const auditService = require('../services/auditService');

const createChecklist = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const { title, description, type, department, assigneeIds, items } = req.body;
    const createdById = req.user.userId;
    const checklist = await checklistService.createChecklist({
      auditId,
      createdById,
      title,
      description,
      type,
      department,
      assigneeIds,
      items,
    });
    res.status(201).json({ message: 'Checklist created', checklist });
  } catch (error) {
    next(error);
  }
};

const getChecklistsByAudit = async (req, res, next) => {
  try {
    const { auditId } = req.params;
    const checklists = await checklistService.getChecklistsByAudit(auditId);
    res.json({ message: 'Checklists fetched', checklists });
  } catch (error) {
    next(error);
  }
};

const getChecklistById = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const checklist = await checklistService.getChecklistById(checklistId);
    if (!checklist) return res.status(404).json({ message: 'Checklist not found' });
    res.json({ message: 'Checklist fetched', checklist });
  } catch (error) {
    next(error);
  }
};

const updateChecklist = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const { title, description, type, department } = req.body;
    const userId = req.user.userId;
    console.log('[ChecklistController] updateChecklist called', { checklistId, title, description, type, department, userId });
    // Check if checklist exists before update
    const checklistExists = await require('../repositories/checklistRepository').getChecklistById(checklistId);
    console.log('[ChecklistController] checklistExists:', checklistExists ? 'FOUND' : 'NOT FOUND', checklistExists?.id);
    if (!checklistExists) {
      return res.status(404).json({ message: 'Checklist not found before update' });
    }
    const checklist = await checklistService.updateChecklist(checklistId, { title, description, type, department }, userId);
    console.log('[ChecklistController] checklist updated:', checklist?.id);
    res.json({ message: 'Checklist updated', checklist });
  } catch (error) {
    console.error('[ChecklistController] updateChecklist error:', error);
    next(error);
  }
};

const deleteChecklist = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const userId = req.user.userId;
    await checklistService.deleteChecklist(checklistId, userId);
    res.json({ message: 'Checklist deleted' });
  } catch (error) {
    next(error);
  }
};

const getChecklistAccess = async (req, res, next) => {
  try {
    const { checklistId } = req.params;
    const userId = req.user.userId;
    const access = await checklistService.getUserChecklistAccess(checklistId, userId);
    res.json({ message: 'Access information retrieved', access });
  } catch (error) {
    next(error);
  }
};

const updateChecklistById = async (id, data, req, res, next) => {
  try {
    console.log('[ChecklistController] updateChecklistById called', { id, data });
    
    // Check if checklist exists before update
    const checklistExists = await require('../repositories/checklistRepository').getChecklistById(id);
    console.log('[ChecklistController] checklistExists:', checklistExists ? 'FOUND' : 'NOT FOUND', checklistExists?.id);
    if (!checklistExists) {
      return res.status(404).json({ message: 'Checklist not found before update' });
    }
    
    // Use checklistService instead of auditService for proper schema relationships
    const userId = req.user.userId;
    
    // Update basic checklist info
    const updatedChecklist = await checklistService.updateChecklist(id, {
      title: data.title,
      description: data.description,
      type: data.type,
      department: data.department
    }, userId);
    
    // Update assignees and items using repository directly
    const { prisma } = require('../../prisma/client');
    
    // Update assignees
    if (data.assigneeIds) {
      // Remove existing assignees
      await prisma.checklistAssignee.deleteMany({ where: { checklistId: id } });
      // Add new assignees
      if (data.assigneeIds.length > 0) {
        await prisma.checklistAssignee.createMany({
          data: data.assigneeIds.map(userId => ({ checklistId: id, userId }))
        });
      }
    }
    
    // Update items
    if (data.items) {
      // Remove existing items
      await prisma.checklistItem.deleteMany({ where: { checklistId: id } });
      // Add new items
      if (data.items.length > 0) {
        await prisma.checklistItem.createMany({
          data: data.items.map((item, idx) => ({
            checklistId: id,
            title: item.title,
            description: item.description || '',
            clauseNumber: item.clauseNumber || '',
            isRequired: item.isRequired !== false,
            order: item.order || idx + 1,
            attachments: item.attachments || [],
            completed: false
          }))
        });
      }
    }
    
    // Get updated checklist with all relations
    const finalChecklist = await prisma.checklist.findUnique({
      where: { id },
      include: {
        items: { orderBy: { order: 'asc' } },
        assignees: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
    
    console.log('[ChecklistController] checklist updated (with items):', finalChecklist?.id);
    res.json({ message: 'Checklist updated', checklist: finalChecklist });
  } catch (error) {
    console.error('[ChecklistController] updateChecklistById error:', error);
    next(error);
  }
};

/**
 * Get user's checklist scope for an audit (for findings security)
 */
const getUserChecklistScope = async (req, res, next) => {
  try {
    const { auditId, userId } = req.params;
    const { tenantId, userId: currentUserId } = req.user;

    console.log('🔒 Getting user checklist scope:', { auditId, userId, currentUserId, tenantId });

    // Security check: Users can only access their own scope or if they have audit access
    if (userId !== currentUserId) {
      // Check if current user has audit access (team member, team leader, etc.)
      const auditService = require('../services/auditService');
      const audit = await auditService.getAuditById(auditId);
      
      if (!audit) {
        return res.status(404).json({ message: 'Audit not found' });
      }

      const isTeamMember = audit.teamMembers?.some(member => 
        member.userId === currentUserId && member.status === 'ACCEPTED'
      );

      if (!isTeamMember) {
        return res.status(403).json({ message: 'Access denied: You can only view your own scope or audit team members' });
      }
    }

    // Get all checklists for the audit
    const checklists = await checklistService.getChecklistsByAudit(auditId);
    
    // Filter checklists where user is assigned
    const userScopes = [];
    
    for (const checklist of checklists) {
      const isAssigned = checklist.assignees?.some(assignee => assignee.userId === userId) ||
                        checklist.createdBy?.id === userId;
      
      if (isAssigned && checklist.department) {
        const departments = checklist.department.split(',').map(d => d.trim());
        
        userScopes.push({
          checklistId: checklist.id,
          departments,
          canCreate: true,  // Assigned users can create findings
          canView: true,    // Assigned users can view findings
          canEdit: true     // Assigned users can edit findings
        });
      }
    }

    console.log('🔒 User scopes found:', userScopes.length);

    res.json({
      status: 'success',
      data: {
        scopes: userScopes
      }
    });
  } catch (error) {
    console.error('❌ Error getting user checklist scope:', error);
    next(error);
  }
};

module.exports = {
  createChecklist,
  getChecklistsByAudit,
  getChecklistById,
  getChecklistAccess,
  updateChecklist,
  deleteChecklist,
  updateChecklistById,
  getUserChecklistScope,
}; 