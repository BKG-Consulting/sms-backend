const { prisma } = require('../../prisma/client');

const conversationRepository = {
  // Find a conversation by exact participant set (for 1:1 or group)
  findByParticipants: async (participantIds, tenantId) => {
    // Find conversations for this tenant with the same number of participants
    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        participants: {
          every: { userId: { in: participantIds } },
        },
        isGroup: participantIds.length > 2,
      },
      include: { participants: true },
    });
    // Filter to exact match
    return conversations.find(c => {
      const ids = c.participants.map(p => p.userId).sort();
      return ids.length === participantIds.length && ids.every((id, i) => id === participantIds.sort()[i]);
    }) || null;
  },

  create: async ({ tenantId, name, isGroup, participantIds }) => {
    // Ensure unique participant IDs
    const uniqueParticipantIds = [...new Set(participantIds)];
    return prisma.conversation.create({
      data: {
        tenantId,
        name,
        isGroup,
        participants: {
          create: uniqueParticipantIds.map(userId => ({ userId })),
        },
      },
      include: { participants: true },
    });
  },

  findById: async (id) => prisma.conversation.findUnique({ where: { id }, include: { participants: true } }),

  listForUser: async (userId, tenantId) =>
    prisma.conversation.findMany({
      where: {
        tenantId,
        participants: { some: { userId } },
      },
      include: { participants: true },
      orderBy: { updatedAt: 'desc' },
    }),
};

module.exports = conversationRepository; 