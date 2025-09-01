const conversationRepository = require('../repositories/conversationRepository');
const { AppError } = require('../../errors/app.error');

const conversationService = {
  async findOrCreateConversation({ participantIds, tenantId, name, isGroup }) {
    if (!participantIds || participantIds.length < 2) {
      throw new AppError('At least two participants are required', 400);
    }
    // Try to find existing
    let conversation = await conversationRepository.findByParticipants(participantIds, tenantId);
    if (conversation) return conversation;
    // Create new
    conversation = await conversationRepository.create({
      tenantId,
      name: name || null,
      isGroup: !!isGroup,
      participantIds,
    });
    return conversation;
  },

  async listForUser({ userId, tenantId }) {
    return conversationRepository.listForUser(userId, tenantId);
  },

  async getById(id) {
    return conversationRepository.findById(id);
  },
};

module.exports = conversationService; 