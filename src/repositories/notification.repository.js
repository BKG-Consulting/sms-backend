const { prisma } = require('../../prisma/client');

const createNotification = async (data, tx = prisma) => {
  return tx.notification.create({ data });
};

module.exports = { createNotification };