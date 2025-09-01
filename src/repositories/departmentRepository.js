const { prisma } = require('../../prisma/client');

const createDepartment = async (data, tx = prisma, select = undefined) => {
  return tx.department.create({
    data,
    ...(select ? { select } : {})
  });
};

const updateDepartment = async (id, data, tx = prisma) => {
  return tx.department.update({ where: { id }, data });
};

module.exports = { createDepartment, updateDepartment }; 