const documentService = require('../services/documentService');
const { z } = require('zod');

const createDocumentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.string().optional(),
  ownerId: z.string().optional(),
  version: z.string().optional(),
  revision: z.string().optional(),
  autoPublish: z.string().optional().transform(val => val === 'true'),
});

const changeRequestSchema = z.object({
  clauseNumber: z.string().min(1),
  currentClause: z.string().min(1),
  proposedChange: z.string().min(1),
  justification: z.string().min(1),
});

const documentController = {
  createDocument: async (req, res, next) => {
    try {
      const { title, description, type, ownerId, version, revision, autoPublish } = createDocumentSchema.parse(req.body);
      if (!req.file) {
        return res.status(400).json({ message: 'File is required' });
      }
      const uploaderId = req.user.userId;
      const tenantId = req.user.tenantId;
      const file = req.file;
      
      const document = await documentService.createDocument({
        title,
        description,
        type,
        file,
        ownerId: ownerId || uploaderId, // Use provided ownerId or default to uploader
        uploaderId,
        tenantId,
        version,
        revision,
        autoPublish: autoPublish || false,
      });
      res.status(201).json({ message: 'Document created successfully', document });
    } catch (error) {
      next(error);
    }
  },

  listDocuments: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const userId = req.user.userId;
      
      // Use defaultRole if present, otherwise fallback to first role
      const userRole = req.user.defaultRole?.name || req.user.roles?.[0]?.name || 'STAFF';
      
      console.log('DocumentController - User roles:', req.user.roles);
      console.log('DocumentController - Selected userRole (using defaultRole):', userRole);
      
      const documents = await documentService.listDocuments({ 
        tenantId, 
        userRole, 
        userId 
      });
      res.json({ documents });
    } catch (error) {
      next(error);
    }
  },

  getDocument: async (req, res, next) => {
    try {
      const documentId = req.params.id;
      const tenantId = req.user.tenantId;
      const document = await documentService.getDocument({ documentId, tenantId });
      res.json({ document });
    } catch (error) {
      next(error);
    }
  },

  secureViewDocument: async (req, res, next) => {
    try {
      const documentId = req.params.id;
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const { url, fileName } = await documentService.getSecureDocumentFile({ documentId, userId, tenantId });
      res.json({ url, fileName });
    } catch (error) {
      next(error);
    }
  },

  // Submit for approval (Team Leader for audit reports only)
  submitForApproval: async (req, res, next) => {
    try {
      const documentId = req.params.id;
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const userRole = req.user.defaultRole?.name || req.user.roles?.[0]?.name || 'STAFF';
      const document = await documentService.submitForApproval({ documentId, userId, tenantId, userRole });
      res.json({ message: 'Audit report submitted for MR approval', document });
    } catch (error) {
      next(error);
    }
  },

  submitChangeRequest: async (req, res, next) => {
    try {
      console.log('submitChangeRequest called with body:', req.body);
      console.log('submitChangeRequest headers:', req.headers);
      
      const documentId = req.params.id;
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const changeRequestData = changeRequestSchema.parse(req.body);
      
      console.log('submitChangeRequest parsed data:', { documentId, userId, tenantId, changeRequestData });
      
      const result = await documentService.submitChangeRequest({
        documentId,
        userId,
        tenantId,
        ...changeRequestData
      });
      
      console.log('submitChangeRequest result:', result);
      
      res.status(201).json({ 
        message: 'Change request submitted successfully', 
        changeRequest: result 
      });
    } catch (error) {
      console.error('submitChangeRequest error:', error);
      next(error);
    }
  },

  // Approve document (MR approves audit reports)
  approveDocument: async (req, res, next) => {
    try {
      const documentId = req.params.id;
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const userRole = req.user.defaultRole?.name || req.user.roles?.[0]?.name || 'STAFF';
      const comment = req.body.comment || '';
      const document = await documentService.approveDocument({ documentId, userId, tenantId, userRole, comment });
      res.json({ message: 'Audit report approved by MR', document });
    } catch (error) {
      next(error);
    }
  },

  // Reject document (MR rejects audit reports)
  rejectDocument: async (req, res, next) => {
    try {
      const documentId = req.params.id;
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const userRole = req.user.defaultRole?.name || req.user.roles?.[0]?.name || 'STAFF';
      const comment = req.body.comment || '';
      const document = await documentService.rejectDocument({ documentId, userId, tenantId, userRole, comment });
      res.json({ message: 'Audit report rejected by MR', document });
    } catch (error) {
      next(error);
    }
  },

  // Fetch all versions for a document
  getDocumentVersions: async (req, res, next) => {
    try {
      const documentId = req.params.id;
      const tenantId = req.user.tenantId;
      const versions = await documentService.getDocumentVersions({ documentId, tenantId });
      res.json({ versions });
    } catch (error) {
      next(error);
    }
  },

  // Fetch all change requests for a document
  getDocumentChangeRequests: async (req, res, next) => {
    try {
      const documentId = req.params.id;
      const tenantId = req.user.tenantId;
      const changeRequests = await documentService.getDocumentChangeRequests({ documentId, tenantId });
      res.json({ changeRequests });
    } catch (error) {
      next(error);
    }
  },

  publishDocument: async (req, res, next) => {
    try {
      const documentId = req.params.id;
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const result = await documentService.publishDocument({ documentId, userId, tenantId });
      res.json({ message: 'Document published and all users notified.', document: result });
    } catch (error) {
      next(error);
    }
  },

  searchDocuments: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId;
      const { title, type, status } = req.query;
      const where = { tenantId };
      if (title) where.title = title;
      if (type) where.type = type;
      if (status) where.status = status;
      const documents = await documentService.searchDocuments(where);
      res.json({ documents });
    } catch (error) {
      next(error);
    }
  },

  // HOD approves a document change request
  approveChangeRequestByHOD: async (req, res, next) => {
    try {
      const changeRequestId = req.params.id;
      const hodId = req.user.userId;
      const tenantId = req.user.tenantId;
      const comment = req.body.comment || '';
      const updatedChangeRequest = await documentService.approveChangeRequestByHOD({ changeRequestId, hodId, tenantId, comment });
      res.json({ message: 'Change request approved by HOD', changeRequest: updatedChangeRequest });
    } catch (error) {
      next(error);
    }
  },

  archiveDocument: async (req, res, next) => {
    try {
      const documentId = req.params.id;
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const document = await documentService.archiveDocument({ documentId, userId, tenantId });
      res.json({ message: 'Document archived successfully', document });
    } catch (error) {
      next(error);
    }
  },

  deleteDocument: async (req, res, next) => {
    try {
      const documentId = req.params.id;
      const userId = req.user.userId;
      const tenantId = req.user.tenantId;
      const userRole = req.user.defaultRole?.name || req.user.roles?.[0]?.name || 'STAFF';
      await documentService.deleteDocument({ documentId, userId, tenantId, userRole });
      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = documentController;