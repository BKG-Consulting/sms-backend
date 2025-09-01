const conversationService = require('../services/conversationService');

const findOrCreateConversation = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    const { participantIds, name, isGroup } = req.body;
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID not found' });
    if (!participantIds || !Array.isArray(participantIds) || participantIds.length < 2) {
      return res.status(400).json({ message: 'At least two participants are required' });
    }
    // Ensure current user is included
    if (!participantIds.includes(userId)) participantIds.push(userId);
    const conversation = await conversationService.findOrCreateConversation({ participantIds, tenantId, name, isGroup });
    res.json({ conversationId: conversation.id, conversation });
  } catch (error) {
    next(error);
  }
};

const listConversations = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant ID not found' });
    const conversations = await conversationService.listForUser({ userId, tenantId });
    res.json({ conversations });
  } catch (error) {
    next(error);
  }
};

module.exports = { findOrCreateConversation, listConversations }; 