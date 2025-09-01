// src/repositories/auditProgramRepository.js
const { prisma } = require('../../prisma/client');

const auditProgramRepository = {
  create: async (data, tx = prisma) => {
  console.log('[Repository] Creating audit program with data:', data);

  const created = await tx.auditProgram.create({ data });

  console.log('[Repository] Created:', created);
  return created;
},

  findById: (id, opts = {}) => prisma.auditProgram.findUnique({ where: { id }, ...opts }),

  update: (id, data, tx = prisma) => tx.auditProgram.update({ where: { id }, data }),

  findMany: (where = {}, opts = {}) => {
    console.log('[Repository] Finding many programs with filter:', where);
    return prisma.auditProgram.findMany({ where, ...opts });
  },

  delete: (id, tx = prisma) => tx.auditProgram.delete({ where: { id } }),

  findByIdWithAudits: (id) =>
    prisma.auditProgram.findUnique({
      where: { id },
      include: {
        audits: {
          include: {
            teamMembers: { include: { user: true } },
            // Add more relations as needed
          }
        },
        createdBy: true,
        approvedBy: true,
        tenant: true,
      }
    }),

  findAuditLogsByEntity: (entityType, entityId) =>
    prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        tenant: { select: { id: true, name: true } },
      },
    }),
};

module.exports = auditProgramRepository;
