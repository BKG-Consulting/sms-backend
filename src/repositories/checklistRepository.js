const { prisma } = require('../../prisma/client');

const createChecklist = (data) => prisma.checklist.create({ data, include: { items: true, assignees: true } });
const getChecklistsByAudit = (auditId) => prisma.checklist.findMany({ where: { auditId }, include: { items: true, assignees: { include: { user: true } } } });
const getChecklistById = (id) => prisma.checklist.findUnique({ where: { id }, include: { items: true, assignees: { include: { user: true } } } });
const updateChecklist = (id, data) => {
  console.log('[ChecklistRepository] updateChecklist called', { id, data });
  return prisma.checklist.update({ where: { id }, data, include: { items: true, assignees: { include: { user: true } } } })
    .then(result => {
      console.log('[ChecklistRepository] updateChecklist result', result?.id);
      return result;
    })
    .catch(error => {
      console.error('[ChecklistRepository] updateChecklist error', error);
      throw error;
    });
};
const deleteChecklist = (id) => prisma.checklist.delete({ where: { id } });

module.exports = {
  createChecklist,
  getChecklistsByAudit,
  getChecklistById,
  updateChecklist,
  deleteChecklist,
}; 