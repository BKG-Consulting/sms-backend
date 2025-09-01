// src/repositories/auditRepository.js
// Handles DB access for Audit
const { prisma } = require('../../prisma/client');

const auditRepository = {
  create: (data, tx = prisma) => tx.audit.create({ data }),
  findById: (id, opts = {}) => prisma.audit.findUnique({ where: { id }, ...opts }),
  update: (id, data, tx = prisma) => tx.audit.update({ where: { id }, data }),
  findMany: (where = {}, opts = {}) => prisma.audit.findMany({ where, ...opts }),

  // Planning Meeting
  createPlanningMeeting: (data, tx = prisma) => tx.auditPlanningMeeting.create({ data }),
  findPlanningMeetingById: (id, opts = {}) => prisma.auditPlanningMeeting.findUnique({ where: { id }, ...opts }),
  findPlanningMeetingsByAudit: (auditId, opts = {}) => prisma.auditPlanningMeeting.findMany({ where: { auditId }, ...opts }),
  updatePlanningMeeting: (id, data, tx = prisma) => tx.auditPlanningMeeting.update({ where: { id }, data }),
  deletePlanningMeeting: (id, tx = prisma) => tx.auditPlanningMeeting.delete({ where: { id } }),

  // Attendance
  createPlanningAttendance: (data, tx = prisma) => tx.auditPlanningAttendance.create({ data }),
  upsertPlanningAttendance: (where, data, tx = prisma) => tx.auditPlanningAttendance.upsert({ where, update: data, create: data }),
  findAttendancesByMeeting: (meetingId, opts = {}) => prisma.auditPlanningAttendance.findMany({ where: { meetingId }, ...opts }),
  createManyPlanningAttendance: (data, tx = prisma) => tx.auditPlanningAttendance.createMany({ data }),

  // Agenda
  createPlanningAgenda: (data, tx = prisma) => tx.auditPlanningAgenda.create({ data }),
  findAgendasByMeeting: (meetingId, opts = {}) => prisma.auditPlanningAgenda.findMany({ where: { meetingId }, ...opts }),
  deleteAgenda: (id, tx = prisma) => tx.auditPlanningAgenda.delete({ where: { id } }),
  createManyPlanningAgenda: (data, tx = prisma) => tx.auditPlanningAgenda.createMany({ data }),
};

module.exports = auditRepository;