const checklistRepository = require('../repositories/checklistRepository');
const { prisma } = require('../../prisma/client');
const { AppError } = require('../../errors/app.error');

// Helper function to check if user is assigned to checklist
async function isUserAssignedToChecklist(checklistId, userId) {
  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
    include: { 
      assignees: { include: { user: true } },
      createdBy: true 
    }
  });
  
  if (!checklist) {
    throw new AppError('Checklist not found', 404);
  }
  
  // Creator can always edit
  if (checklist.createdById === userId) {
    return true;
  }
  
  // Check if user is assigned to the checklist
  return checklist.assignees.some(assignee => assignee.userId === userId);
}

async function createChecklist({ auditId, createdById, title, description, type, department, assigneeIds, items }) {
  // Validate audit exists
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: { teamMembers: true },
  });
  if (!audit) throw new AppError('Audit not found', 404);
  // Validate creator is a team member
  if (!audit.teamMembers.some(tm => tm.userId === createdById)) {
    throw new AppError('You are not a team member of this audit', 403);
  }
  // Validate assignees are team members
  if (assigneeIds && assigneeIds.some(id => !audit.teamMembers.some(tm => tm.userId === id))) {
    throw new AppError('One or more assignees are not team members of this audit', 400);
  }
  // Create checklist with items and assignees
  return checklistRepository.createChecklist({
    auditId,
    createdById,
    title,
    description,
    type,
    department,
    assignees: assigneeIds ? { create: assigneeIds.map(userId => ({ userId })) } : undefined,
    items: items && items.length > 0 ? { create: items.map((item, idx) => ({
      title: item.title,
      description: item.description,
      clauseNumber: item.clauseNumber,
      isRequired: item.isRequired !== false,
      order: item.order ?? idx + 1,
      attachments: item.attachments || [],
    })) } : undefined,
  });
}

function getChecklistsByAudit(auditId) {
  return checklistRepository.getChecklistsByAudit(auditId);
}

function getChecklistById(id) {
  return checklistRepository.getChecklistById(id);
}

async function updateChecklist(id, { title, description, type, department }, userId) {
  console.log('[ChecklistService] updateChecklist called', { id, title, description, type, department, userId });
  
  // Check if user is assigned to this checklist
  const hasAccess = await isUserAssignedToChecklist(id, userId);
  if (!hasAccess) {
    throw new AppError('You are not assigned to this checklist. Only assigned members can edit it.', 403);
  }
  
  // Only allow meta updates here (not items/assignees)
  const updated = await checklistRepository.updateChecklist(id, { title, description, type, department });
  console.log('[ChecklistService] updateChecklist result', updated?.id);
  return updated;
}

async function deleteChecklist(id, userId) {
  // Check if user is assigned to this checklist
  const hasAccess = await isUserAssignedToChecklist(id, userId);
  if (!hasAccess) {
    throw new AppError('You are not assigned to this checklist. Only assigned members can delete it.', 403);
  }
  
  return checklistRepository.deleteChecklist(id);
}

// Helper function to get user's access level for a checklist
async function getUserChecklistAccess(checklistId, userId) {
  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
    include: { 
      assignees: { include: { user: true } },
      createdBy: true 
    }
  });
  
  if (!checklist) {
    return { canEdit: false, canDelete: false, isCreator: false, isAssigned: false };
  }
  
  const isCreator = checklist.createdById === userId;
  const isAssigned = checklist.assignees.some(assignee => assignee.userId === userId);
  
  return {
    canEdit: isCreator || isAssigned,
    canDelete: isCreator || isAssigned,
    isCreator,
    isAssigned
  };
}

module.exports = {
  createChecklist,
  getChecklistsByAudit,
  getChecklistById,
  updateChecklist,
  deleteChecklist,
  isUserAssignedToChecklist,
  getUserChecklistAccess,
}; 