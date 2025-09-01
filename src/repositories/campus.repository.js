const { prisma } = require('../../prisma/client');

const createCampus = async (data, tx = prisma) => {
  return tx.campus.create({ data });
};

const getCampusesByTenant = async (tenantId, tx = prisma) => {
  return tx.campus.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' }
  });
};

module.exports = { createCampus, getCampusesByTenant };