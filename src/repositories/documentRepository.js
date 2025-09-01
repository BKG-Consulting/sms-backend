const { prisma } = require('../../prisma/client');

const documentRepository = {
  createDocument: async (data, tx = prisma) => {
    return tx.document.create({ data });
  },
  createDocumentVersion: async (data, tx = prisma) => {
    return tx.documentVersion.create({ data });
  },
};

module.exports = documentRepository;
