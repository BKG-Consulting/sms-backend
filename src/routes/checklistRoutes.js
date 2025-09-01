const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklistController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Upsert checklist: create if no id, update if id is present
router.post('/audits/:auditId/checklists', authenticateToken, async (req, res, next) => {
  try {
    const { id, ...data } = req.body;
    const auditId = req.params.auditId;
    if (id) {
      // Update existing checklist
      await checklistController.updateChecklistById(id, data, req, res, next);
    } else {
      // Create new checklist
      await checklistController.createChecklist(req, res, next);
    }
  } catch (error) {
    next(error);
  }
});
// Get all checklists for an audit
router.get('/audits/:auditId/checklists', authenticateToken, checklistController.getChecklistsByAudit);
// Get checklist by ID
router.get('/checklists/:checklistId', authenticateToken, checklistController.getChecklistById);
// Get user access information for a checklist
router.get('/checklists/:checklistId/access', authenticateToken, checklistController.getChecklistAccess);
// Update checklist
router.put('/checklists/:checklistId', authenticateToken, checklistController.updateChecklist);
// Delete checklist
router.delete('/checklists/:checklistId', authenticateToken, checklistController.deleteChecklist);

module.exports = router; 