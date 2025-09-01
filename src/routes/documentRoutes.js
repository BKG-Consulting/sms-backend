const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');
const upload = require('../middleware/multer');

// Only MR (Document Custodian) can create documents
router.post('/', authenticateToken,  upload.single('file'), documentController.createDocument);

// List documents (filtered by user role - MR sees all, others see published only)
router.get('/', authenticateToken,  documentController.listDocuments);

// --- Add search endpoint ---
router.get('/search', authenticateToken, documentController.searchDocuments);

// Get specific document (all authenticated users in tenant)
router.get('/:id', authenticateToken,  documentController.getDocument);

// Securely serve a document's PDF (authenticated, role-based)
router.get('/:id/secure-view', authenticateToken,  documentController.secureViewDocument);

// Submit audit report for approval (Team Leaders only) - TEMPORARILY DISABLED PERMISSION CHECK
router.patch('/:id/submit-for-approval', authenticateToken, documentController.submitForApproval);

// Submit change request (all authenticated users can submit change requests)
router.post('/:id/change-request', authenticateToken,  documentController.submitChangeRequest);

// MR (Document Custodian) can approve/reject audit reports
router.patch('/:id/approve', authenticateToken, documentController.approveDocument);
router.patch('/:id/reject', authenticateToken,  documentController.rejectDocument);

// Fetch all versions for a document
router.get('/:id/versions', authenticateToken,  documentController.getDocumentVersions);

// Fetch all change requests for a document
router.get('/:id/change-requests', authenticateToken, documentController.getDocumentChangeRequests);

// Publish document (MR as Document Custodian)
router.patch('/:id/publish', authenticateToken,  documentController.publishDocument);

// HOD approves a document change request
router.patch('/change-requests/:id/hod-approve', authenticateToken, documentController.approveChangeRequestByHOD);

// Archive document (MR as Document Custodian)
router.patch('/:id/archive', authenticateToken, documentController.archiveDocument);

// Delete document (Owner or MR can delete)
router.delete('/:id', authenticateToken, documentController.deleteDocument);

module.exports = router;
