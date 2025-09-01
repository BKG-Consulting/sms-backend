const { prisma } = require('../../prisma/client');

const feedbackRepository = {
  createFeedback: async (data) => {
    return prisma.feedback.create({ data });
  },
  getFeedbacks: async (filter = {}) => {
    return prisma.feedback.findMany({
      where: filter,
      include: {
        department: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  },
  getFeedbackById: async (id) => {
    return prisma.feedback.findUnique({
      where: { id },
      include: {
        department: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
  }
};

module.exports = feedbackRepository; 