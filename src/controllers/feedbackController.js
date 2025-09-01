const feedbackService = require('../services/feedbackService');
const { z } = require('zod');

const feedbackSchema = z.object({
  origin: z.enum(['INTERNAL', 'EXTERNAL']),
  category: z.string().min(1),
  subject: z.string().min(1),
  source: z.enum(['ANONYMOUS', 'USER', 'OTHER']),
  sourceDetail: z.string().optional(),
  departmentId: z.string().optional().nullable(),
  rating: z.number().min(1).max(5).optional(),
  message: z.string().min(1)
});

const feedbackController = {
  createFeedback: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const createdById = req.user.userId;
      const data = feedbackSchema.parse(req.body);

      const feedback = await feedbackService.createFeedback({
        ...data,
        tenantId,
        createdById: data.source === 'USER' ? createdById : null
      });

      res.status(201).json({ feedback });
    } catch (error) {
      next(error);
    }
  },

  getFeedbacks: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const feedbacks = await feedbackService.getFeedbacks(tenantId);
      res.json({ feedbacks });
    } catch (error) {
      next(error);
    }
  },

  getFeedbackById: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const { id } = req.params;
      const feedback = await feedbackService.getFeedbackById(id, tenantId);
      res.json({ feedback });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = feedbackController; 