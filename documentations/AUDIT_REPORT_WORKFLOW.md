# AUDIT_REPORT Document Workflow

## Overview
This document describes the updated workflow for AUDIT_REPORT documents in the system.

## Workflow States

### 1. DRAFT
- **Who can create**: Team Leaders
- **Description**: Initial state when an audit report is created
- **Actions available**:
  - Team Leader can submit for approval
  - Team Leader can edit the document

### 2. UNDER_REVIEW
- **Who can set**: Team Leaders (via submit for approval)
- **Description**: Document is submitted to MR for review
- **Actions available**:
  - MR can approve (moves to PUBLISHED)
  - MR can reject (moves to REJECTED)

### 3. PUBLISHED
- **Who can set**: MR (via approve)
- **Description**: Document is approved and available to all users
- **Actions available**:
  - All users can view the document
  - MR can archive the document

### 4. REJECTED
- **Who can set**: MR (via reject)
- **Description**: Document was rejected by MR
- **Actions available**:
  - Team Leader can resubmit for approval (moves back to UNDER_REVIEW)
  - Team Leader can archive the document

## Key Changes from Previous Workflow

### Before:
```
DRAFT → UNDER_REVIEW → APPROVED → PUBLISHED
```

### After:
```
DRAFT → UNDER_REVIEW → PUBLISHED
```

## API Endpoints

### 1. Submit for Approval
- **Endpoint**: `PATCH /api/documents/:id/submit-for-approval`
- **Permission**: `document:submit-for-approval`
- **Who can use**: Team Leaders only
- **Status change**: DRAFT → UNDER_REVIEW
- **Notification**: MR is notified

### 2. Approve Document
- **Endpoint**: `PATCH /api/documents/:id/approve`
- **Permission**: `document:approve`
- **Who can use**: MR only
- **Status change**: UNDER_REVIEW → PUBLISHED
- **Notifications**: 
  - Team Leader is notified of approval and publication
  - All users are notified of new published document

### 3. Reject Document
- **Endpoint**: `PATCH /api/documents/:id/reject`
- **Permission**: `document:reject`
- **Who can use**: MR only
- **Status change**: UNDER_REVIEW → REJECTED
- **Notification**: Team Leader is notified of rejection

## Important Notes

1. **No separate publish step**: AUDIT_REPORT documents are automatically published when approved by MR
2. **Status validation**: Each action checks the current document status before proceeding
3. **Real-time notifications**: All users receive real-time notifications when documents are published
4. **MR documents**: Other document types (non-AUDIT_REPORT) still use the old workflow

## Error Messages

- "Only DRAFT documents can be submitted for approval"
- "Only documents under review can be approved"
- "Only documents under review can be rejected"
- "Only Team Leader can submit this audit report for approval"
- "Only MR (Document Custodian) can approve this audit report"
- "Only MR (Document Custodian) can reject this audit report"
- "Audit reports are automatically published when approved by MR. Use the approve endpoint instead."

## Frontend Integration

The frontend should:
1. Show "Submit for Approval" button only for DRAFT AUDIT_REPORT documents owned by Team Leaders
2. Show "Approve" and "Reject" buttons only for UNDER_REVIEW AUDIT_REPORT documents for MR users
3. Hide "Publish" button for AUDIT_REPORT documents (since they're auto-published)
4. Update document status display to reflect the new workflow 