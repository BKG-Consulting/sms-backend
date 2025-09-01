const changeRequestService = require('../services/changeRequestService');
const { z } = require('zod');

const approvalSchema = z.object({
  comment: z.string().optional(),
});

const verificationSchema = z.object({
  verified: z.boolean(),
  comment: z.string().optional(),
});

const changeRequestController = {
  getChangeRequests: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      const userRoles = req.user.roles?.map(role => role.name) || [];
      
      const changeRequests = await changeRequestService.getChangeRequests({ 
        tenantId, 
        userId, 
        userRoles 
      });
      
      res.json({ changeRequests });
    } catch (error) {
      next(error);
    }
  },

  getChangeRequest: async (req, res, next) => {
    try {
      const changeRequestId = req.params.id;
      const tenantId = req.user.tenantId;
      
      const changeRequest = await changeRequestService.getChangeRequest({ 
        changeRequestId, 
        tenantId 
      });
      
      res.json({ changeRequest });
    } catch (error) {
      next(error);
    }
  },

  approveChangeRequest: async (req, res, next) => {
    try {
      const changeRequestId = req.params.id;
      const hodId = req.user.userId;
      const tenantId = req.user.tenantId;
      const { comment } = approvalSchema.parse(req.body);
      
      const result = await changeRequestService.approveChangeRequest({ 
        changeRequestId, 
        hodId, 
        tenantId, 
        comment,
        reqUser: req.user,
      });
      
      res.json({ 
        message: 'Change request approved successfully. Principal will be notified for verification.', 
        changeRequest: result 
      });
    } catch (error) {
      next(error);
    }
  },

  rejectChangeRequest: async (req, res, next) => {
    try {
      const changeRequestId = req.params.id;
      const hodId = req.user.userId;
      const tenantId = req.user.tenantId;
      const { comment } = approvalSchema.parse(req.body);
      
      const result = await changeRequestService.rejectChangeRequest({ 
        changeRequestId, 
        hodId, 
        tenantId, 
        comment,
        reqUser: req.user,
      });
      
      res.json({ 
        message: 'Change request rejected successfully. Requester will be notified.', 
        changeRequest: result 
      });
    } catch (error) {
      next(error);
    }
  },

  verifyChangeRequest: async (req, res, next) => {
    try {
      const changeRequestId = req.params.id;
      const principalId = req.user.userId;
      const tenantId = req.user.tenantId;
      const { verified, comment } = verificationSchema.parse(req.body);
      
      const result = await changeRequestService.verifyChangeRequest({ 
        changeRequestId, 
        principalId, 
        tenantId, 
        verified, 
        comment 
      });
      
      const message = verified 
        ? 'Change request verified successfully. MR will be notified to implement changes.' 
        : 'HOD approval declined. Change request will be returned for revision.';
      
      res.json({ message, changeRequest: result });
    } catch (error) {
      next(error);
    }
  },

  applyChangeRequest: async (req, res, next) => {
    try {
      console.log('Controller: applyChangeRequest called', {
        changeRequestId: req.params.id,
        mrId: req.user.userId,
        tenantId: req.user.tenantId,
        hasFile: !!req.file,
        fileInfo: req.file ? {
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size
        } : null
      });

      const changeRequestId = req.params.id;
      const mrId = req.user.userId;
      const tenantId = req.user.tenantId;
      const file = req.file;
      
      if (!file) {
        console.error('Controller: No file provided');
        return res.status(400).json({ message: 'Updated document file is required' });
      }
      
      console.log('Controller: Calling service with file', {
        changeRequestId,
        mrId,
        tenantId,
        fileName: file.originalname
      });

      const result = await changeRequestService.applyChangeRequest({ 
        changeRequestId, 
        mrId, 
        tenantId, 
        file 
      });
      
      console.log('Controller: Service call successful', {
        resultId: result.id,
        newStatus: result.status
      });

      res.json({ 
        message: 'Change request applied successfully by MR. New document version has been created.', 
        changeRequest: result 
      });
    } catch (error) {
      console.error('Controller: applyChangeRequest error:', error);
      next(error);
    }
  },
};

module.exports = changeRequestController; 