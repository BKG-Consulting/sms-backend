const express = require('express');
const router = express.Router();
const { prisma } = require('../../prisma/client');
const notificationRepository = require('../repositories/notification.repository');

// TEST ROUTE: Simulate HOD submitting a proposed action and notify auditor
router.post('/test-hod-proposed-action-notification', async (req, res) => {
  try {
    const { correctiveActionId, proposedAction, hodUserId } = req.body;
    // Fetch corrective action and related info
    const correctiveAction = await prisma.correctiveAction.findUnique({
      where: { id: correctiveActionId },
      include: {
        nonConformity: true,
        createdBy: true,
      },
    });
    if (!correctiveAction) return res.status(404).json({ error: 'Corrective action not found' });
    // Simulate HOD submitting proposed action
    await prisma.correctiveAction.update({
      where: { id: correctiveActionId },
      data: { proposedAction, status: 'IN_PROGRESS' },
    });
    // Notify auditor (simulate the real logic)
    await notificationRepository.createNotification({
      type: 'ROOT_CAUSE_ANALYSIS_SUBMITTED',
      title: 'Root Cause Analysis Submitted',
      message: `The HOD has submitted a root cause analysis for corrective action: ${correctiveAction.title}.`,
      tenantId: correctiveAction.createdBy.tenantId,
      targetUserId: correctiveAction.createdById,
      link: `/auditors/corrective-actions/${correctiveAction.nonConformityId}`,
      metadata: { correctiveActionId, nonConformityId: correctiveAction.nonConformityId },
    });
    res.json({ success: true, message: 'Test notification sent to auditor with correct link.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
