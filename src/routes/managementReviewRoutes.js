const express = require('express');
const managementReviewController = require('../controllers/managementReviewController');
const { authenticateToken, restrictTo, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();

// Get users with management review permission (must come before parameterized routes)
router
  .route('/users-with-permission')
  .get(
    authenticateToken,
    requirePermission('managementReview', 'read'),
    managementReviewController.getUsersWithManagementReviewPermission
  );

// Management Review Invitation Routes
router
  .route('/:auditId/management-review/invitation')
  .post(
    authenticateToken,
    requirePermission('managementReview', 'create'),
    managementReviewController.sendManagementReviewInvitation
  )
  .get(
    authenticateToken,
    requirePermission('managementReview', 'read'),
    managementReviewController.checkManagementReviewInvitationStatus
  );

// Management Review Meeting Routes
router
  .route('/:auditId/management-review')
  .post(
    authenticateToken,
    requirePermission('managementReview', 'create'),
    managementReviewController.createManagementReviewMeeting
  )
  .get(
    authenticateToken,
    requirePermission('managementReview', 'read'),
    managementReviewController.getManagementReviewMeetingForAudit
  );

router
  .route('/:auditId/management-review/meetings')
  .get(
    authenticateToken,
    requirePermission('managementReview', 'read'),
    managementReviewController.getManagementReviewMeetingsByAudit
  );

router
  .route('/management-review/meetings/:meetingId')
  .get(
    authenticateToken,
    requirePermission('managementReview', 'read'),
    managementReviewController.getManagementReviewMeetingById
  )
  .patch(
    authenticateToken,
    requirePermission('managementReview', 'update'),
    managementReviewController.updateManagementReviewMeeting
  )
  .delete(
    authenticateToken,
    requirePermission('managementReview', 'delete'),
    managementReviewController.deleteManagementReviewMeeting
  );

// Meeting Workflow Routes
router
  .route('/management-review/meetings/:meetingId/start')
  .patch(
    authenticateToken,
    requirePermission('managementReview', 'update'),
    managementReviewController.startManagementReviewMeeting
  );

router
  .route('/management-review/meetings/:meetingId/complete')
  .patch(
    authenticateToken,
    requirePermission('managementReview', 'update'),
    managementReviewController.completeManagementReviewMeeting
  );

// Minute Management Routes
router
  .route('/management-review/meetings/:meetingId/minutes')
  .post(
    authenticateToken,
    requirePermission('managementReview', 'update'),
    managementReviewController.createOrUpdateMinuteItem
  );

router
  .route('/management-review/minutes/:minuteId')
  .patch(
    authenticateToken,
    requirePermission('managementReview', 'update'),
    managementReviewController.updateMinuteItem
  )
  .delete(
    authenticateToken,
    requirePermission('managementReview', 'delete'),
    managementReviewController.deleteMinuteItem
  );

// Attendance Management Routes
router
  .route('/management-review/meetings/:meetingId/attendance')
  .get(
    authenticateToken,
    requirePermission('managementReview', 'read'),
    managementReviewController.getAttendancesByMeeting
  );

router
  .route('/management-review/meetings/:meetingId/attendance/:userId')
  .patch(
    authenticateToken,
    requirePermission('managementReview', 'update'),
    managementReviewController.createOrUpdateAttendance
  );

// Template Routes
router
  .route('/management-review/templates/minutes')
  .get( 
    authenticateToken,
    requirePermission('managementReview', 'read'),
    managementReviewController.getManagementReviewMinutesTemplate
  );

module.exports = router; 