const documentRepository = require('../repositories/documentRepository');
const { prisma } = require('../../prisma/client');
const path = require('path');
const storageService = require('../config/storage');
const notificationService = require('./notificationService');

/**
 * Document Audit Trail Helper Functions
 */
const createDocumentAuditLog = async (tx, {
  action,
  entityType,
  entityId,
  userId,
  tenantId,
  details,
  metadata = {},
  ipAddress = null,
  userAgent = null
}) => {
  return await tx.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      userId,
      tenantId,
      details,
      metadata,
      ipAddress,
      userAgent,
      createdAt: new Date()
    }
  });
};

const documentService = {
  createDocument: async ({ title, description, type, file, ownerId, uploaderId, tenantId, version, revision, autoPublish }) => {
    // Upload file using storage service
    const fileName = `${Date.now()}_${file.originalname}`;
    const uploadResult = await storageService.uploadFile(file, fileName);
    const fileUrl = uploadResult.url;

    // Create Document and DocumentVersion in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Determine initial status based on autoPublish
      const initialStatus = autoPublish ? 'PUBLISHED' : 'DRAFT';
      
      const document = await documentRepository.createDocument({
        title,
        description,
        type,
        status: initialStatus,
        tenantId,
        ownerId,
      }, tx);
      
      // Auto-assign version if not provided (use revision as part of version string if provided)
      let versionNumber = 1;
      if (version) {
        // Try to parse version as number, fallback to 1
        const parsedVersion = parseInt(version);
        versionNumber = isNaN(parsedVersion) ? 1 : parsedVersion;
      }
      
      const versionDoc = await documentRepository.createDocumentVersion({
        documentId: document.id,
        version: versionNumber,
        fileUrl,
        s3Key: fileName,
        createdById: uploaderId,
      }, tx);
      
      await tx.document.update({ 
        where: { id: document.id }, 
        data: { currentVersionId: versionDoc.id } 
      });
      
      // Create comprehensive audit trail
      await createDocumentAuditLog(tx, {
        action: 'CREATE',
        entityType: 'DOCUMENT',
        entityId: document.id,
        userId: uploaderId,
              tenantId,
        details: `Created document "${title}" with type ${type}`,
        metadata: {
          documentId: document.id,
          title,
          type,
          status: initialStatus,
          version: versionNumber,
          autoPublish,
          ownerId,
          fileUrl: fileUrl,
          s3Key: fileName
        }
      });

      return { ...document, currentVersion: versionDoc };
    }, {
      timeout: 15000 // 15 seconds timeout
    });

    // Send notifications OUTSIDE the transaction to avoid timeout
    if (autoPublish) {
      try {
        // Use permission-based notification service
        const notificationResult = await notificationService.sendDocumentPublishedNotification(
          { id: result.id, title },
          tenantId
        );
        
        console.log(`📢 Permission-based notification result:`, notificationResult);
      } catch (notificationError) {
        console.error('⚠️ Notification error (non-blocking):', notificationError);
        // Don't fail the entire operation if notifications fail
      }
    }

    return result;
  },

  listDocuments: async ({ tenantId, userRole, userId }) => {
    console.log('DocumentService - listDocuments called with userRole:', userRole);
    // Build the base where clause
    let whereClause = { tenantId };
    
    // MR (Document Custodian): Can see all documents except OBSOLETE
    if (userRole === 'MR') {
      whereClause.status = { not: 'OBSOLETE' };
    } else {
      // Non-MR users: show only PUBLISHED documents
      whereClause.status = 'PUBLISHED';
    }
    
    // Only show documents with active current versions (filter out archived versions)
    whereClause.currentVersion = {
      status: 'ACTIVE'
    };
    
    // Log for debugging
    console.log('DocumentService - Prisma whereClause:', JSON.stringify(whereClause, null, 2));
    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        currentVersion: {
          where: { status: 'ACTIVE' }, // Only include active versions
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        },
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        audit: userRole !== 'MR' ? { select: { id: true, teamMembers: true } } : false,
      },
      orderBy: [
        { isRecentlyUpdated: 'desc' }, // Show recently updated documents first
        { lastUpdatedViaChangeRequest: 'desc' }, // Then by change request update time
        { createdAt: 'desc' } // Finally by creation time
      ],
    });
    console.log('DocumentService - Found', documents.length, 'documents for userRole:', userRole);
    
    // Log recently updated documents for debugging
    const recentlyUpdated = documents.filter(doc => doc.isRecentlyUpdated);
    if (recentlyUpdated.length > 0) {
      console.log('📋 Recently updated documents:', recentlyUpdated.map(doc => ({
        title: doc.title,
        lastUpdatedViaChangeRequest: doc.lastUpdatedViaChangeRequest,
        isRecentlyUpdated: doc.isRecentlyUpdated
      })));
    }
    
    return documents;
  },

  getSecureDocumentFile: async ({ documentId, userId, tenantId }) => {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { currentVersion: true },
    });
    if (!document) throw new Error('Document not found');
    if (document.tenantId !== tenantId) throw new Error('Access denied');
    if (!document.currentVersion) throw new Error('No version available');
    
    const storageType = process.env.STORAGE_TYPE || 'local';
    const fileName = document.currentVersion.s3Key || document.currentVersion.cloudinaryId || 'document.pdf';
    
    let url;
    
    if (storageType === 'cloudinary') {
      // For Cloudinary, we can use the stored URL directly or generate a secure URL
      if (document.currentVersion.fileUrl) {
        url = document.currentVersion.fileUrl;
      } else if (document.currentVersion.cloudinaryId) {
        // Generate a secure Cloudinary URL with transformations
        const cloudinaryService = require('../config/cloudinary');
        url = cloudinaryService.getFileUrl(document.currentVersion.cloudinaryId, {
          secure: true,
          quality: 'auto',
          fetch_format: 'auto'
        });
      } else {
        throw new Error('No Cloudinary URL available for this document');
      }
    } else if (storageType === 's3') {
      // Generate a pre-signed URL for S3
      const s3Key = document.currentVersion.s3Key;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
        Expires: 60 * 5, // 5 minutes
        ResponseContentType: 'application/pdf',
        ResponseContentDisposition: `inline; filename=\"${fileName}\"`,
      };
      url = s3.getSignedUrl('getObject', params);
    } else {
      // For local storage, return the local URL
      url = document.currentVersion.fileUrl || `/uploads/${fileName}`;
    }
    
    return { url, fileName };
  },

  // Helper: Check if user is Team Leader for audit
  isTeamLeader: async (userId, auditId) => {
    if (!auditId) return false;
    const teamMember = await prisma.auditTeamMember.findFirst({
      where: { auditId, userId, role: 'TEAM_LEADER' }
    });
    return !!teamMember;
  },

  // Helper: Find MR user for tenant
  findMR: async (tenantId) => {
    return prisma.user.findFirst({
      where: {
        tenantId,
        userDepartmentRoles: { some: { role: { name: 'MR' } } }
      }
    });
  },

  // Helper: Find Principal user for tenant
  findPrincipal: async (tenantId) => {
    return prisma.user.findFirst({
      where: {
        tenantId,
        userDepartmentRoles: { some: { role: { name: 'Principal' } } }
      }
    });
  },

  // Submit for approval (only for audit reports by Team Leaders)
  submitForApproval: async ({ documentId, userId, tenantId, userRole }) => {
    const document = await prisma.document.findUnique({ where: { id: documentId }, include: { audit: true, owner: true, currentVersion: true } });
    if (!document) throw new Error('Document not found');
    
    // Only audit reports can be submitted for approval by Team Leaders
    if (document.type === 'AUDIT_REPORT') {
      // Only Team Leader for this audit can submit
      if (!await documentService.isTeamLeader(userId, document.auditId)) {
        throw new Error('Only Team Leader can submit this audit report for approval');
      }
      
      // Check if document is in DRAFT status
      if (document.status !== 'DRAFT') {
        throw new Error('Only DRAFT documents can be submitted for approval');
      }
      
      // Set status to UNDER_REVIEW
      const updated = await prisma.document.update({ 
        where: { id: documentId }, 
        data: { status: 'UNDER_REVIEW' }, 
        include: { owner: true, currentVersion: true } 
      });
      
      // Find all MR users for this tenant (following the same pattern as audit program service)
      const mrRole = await prisma.role.findFirst({
        where: {
          name: 'MR',
          tenantId
        }
      });

      if (mrRole) {
        console.log(`Found MR role: ${mrRole.id} for tenant: ${tenantId}`);
        
        // Find all users with the MR role for this tenant using both userRoles and userDepartmentRoles
        const mrUsers = await prisma.user.findMany({
          where: {
            tenantId,
            OR: [
              { userRoles: { some: { roleId: mrRole.id } } },
              { userDepartmentRoles: { some: { roleId: mrRole.id } } }
            ]
          },
          select: { id: true, email: true, firstName: true, lastName: true }
        });

        console.log(`Found ${mrUsers.length} MR users:`, mrUsers.map(u => `${u.firstName} ${u.lastName} (${u.email})`));

        if (mrUsers.length > 0) {
          // Batch notifications for all MR users
          const notificationsData = mrUsers.map(mrUser => ({
            type: 'AUDIT_REPORT_APPROVAL',
            title: 'Audit Report Submitted for Approval',
            message: `An audit report titled '${document.title}' has been submitted for your approval.`,
            tenantId,
            targetUserId: mrUser.id,
            link: `/documents/${documentId}`,
            metadata: {
              documentId,
              documentTitle: document.title,
              auditId: document.auditId,
              submittedBy: document.ownerId
            }
          }));

          await prisma.notification.createMany({ data: notificationsData });

          // Emit real-time notifications for each MR user
          try {
            const socketService = require('./socketService');
            const io = socketService.getIO();
            for (const mrUser of mrUsers) {
              io.to(`user:${mrUser.id}`).emit('notificationCreated', {
                ...notificationsData.find(n => n.targetUserId === mrUser.id),
                userId: mrUser.id
              });
            }
          } catch (e) {
            console.error('Socket emit error (submitForApproval):', e);
          }
        }
      }
      
      return updated;
    } else {
      // MR documents: MR can publish directly without approval
      throw new Error('MR documents do not require approval. You can publish directly.');
    }
  },

  // Approve document (MR approves audit reports and publishes them)
  approveDocument: async ({ documentId, userId, tenantId, userRole, comment }) => {
    const document = await prisma.document.findUnique({ where: { id: documentId }, include: { audit: true, owner: true, currentVersion: true } });
    if (!document) throw new Error('Document not found');
    
    // Only audit reports can be approved by MR
    if (document.type === 'AUDIT_REPORT') {
      // Only MR (Document Custodian) can approve
      if (userRole !== 'MR') {
        throw new Error('Only MR (Document Custodian) can approve this audit report');
      }
      
      // Check if document is in UNDER_REVIEW status
      if (document.status !== 'UNDER_REVIEW') {
        throw new Error('Only documents under review can be approved');
      }
      
      // Update status directly to PUBLISHED (skip APPROVED status)
      const updated = await prisma.document.update({ 
        where: { id: documentId }, 
        data: { status: 'PUBLISHED' }, 
        include: { owner: true, currentVersion: true } 
      });
      
      // Notify audit team leader about approval and publication
      await prisma.notification.create({
        data: {
          type: 'DOCUMENT_APPROVAL',
          title: 'Audit Report Approved and Published',
          message: `Your audit report '${document.title}' has been approved by MR and is now published and available to all users.${comment ? ' Comment: ' + comment : ''}`,
          tenantId,
          targetUserId: document.ownerId,
          link: `/documents/${documentId}`
        }
      });
      
      // Notify all users in the tenant about the new published document
      const users = await prisma.user.findMany({
        where: { tenantId }
      });
      
      // Get socket.io instance for real-time notifications
      const socketService = require('./socketService');
      const io = socketService.getIO();
      
      // Notify all users and emit real-time notification
      await Promise.all(users.map(async user => {
        const notification = await prisma.notification.create({
          data: {
            type: 'DOCUMENT_PUBLISHED',
            title: 'New Audit Report Published',
            message: `The audit report "${document.title}" has been approved and is now available to all users.`,
            tenantId,
            targetUserId: user.id,
            link: `/documents/${documentId}`
          }
        });
        // Emit real-time notification
        io.to(`user:${user.id}`).emit('notificationCreated', { ...notification, userId: user.id });
      }));
      
      return updated;
    } else {
      // MR documents: MR can publish directly without approval
      throw new Error('MR documents do not require approval. You can publish directly.');
    }
  },

  // Reject document (MR rejects audit reports and returns to DRAFT for resubmission)
  rejectDocument: async ({ documentId, userId, tenantId, userRole, comment }) => {
    const document = await prisma.document.findUnique({ where: { id: documentId }, include: { audit: true, owner: true, currentVersion: true } });
    if (!document) throw new Error('Document not found');
    
    // Only audit reports can be rejected by MR
    if (document.type === 'AUDIT_REPORT') {
      // Only MR (Document Custodian) can reject
      if (userRole !== 'MR') {
        throw new Error('Only MR (Document Custodian) can reject this audit report');
      }
      
      // Check if document is in UNDER_REVIEW status
      if (document.status !== 'UNDER_REVIEW') {
        throw new Error('Only documents under review can be rejected');
      }
      
      // Update status back to DRAFT so team leader can make changes and resubmit
      const updated = await prisma.document.update({ 
        where: { id: documentId }, 
        data: { status: 'DRAFT' }, 
        include: { owner: true, currentVersion: true } 
      });
      
      // Notify audit team leader about rejection with detailed message
      const notification = await prisma.notification.create({
        data: {
          type: 'DOCUMENT_REJECTION',
          title: 'Audit Report Rejected - Returned to Draft',
          message: `Your audit report '${document.title}' has been rejected by MR and returned to DRAFT status. You can make the suggested changes and resubmit for approval.${comment ? ' MR Comments: ' + comment : ''}`,
          tenantId,
          targetUserId: document.ownerId,
          link: `/documents/${documentId}`,
          metadata: {
            documentId,
            documentTitle: document.title,
            auditId: document.auditId,
            rejectedBy: userId,
            rejectionComment: comment,
            previousStatus: 'UNDER_REVIEW',
            newStatus: 'DRAFT'
          }
        }
      });

      // Emit real-time notification to the team leader
      try {
        const socketService = require('./socketService');
        const io = socketService.getIO();
        io.to(`user:${document.ownerId}`).emit('notificationCreated', { ...notification, userId: document.ownerId });
        console.log(`📡 Real-time notification sent to Team Leader: ${document.owner?.firstName} ${document.owner?.lastName} (${document.owner?.email})`);
      } catch (e) {
        console.error('Socket emit error (rejectDocument):', e);
      }
      
      console.log(`✅ Audit report "${document.title}" rejected and returned to DRAFT status`);
      console.log(`   Rejected by: ${userRole} (${userId})`);
      console.log(`   Team Leader notified: ${document.owner?.firstName} ${document.owner?.lastName} (${document.owner?.email})`);
      console.log(`   Notification ID: ${notification.id}`);
      console.log(`   Notification type: ${notification.type}`);
      console.log(`   Target user ID: ${notification.targetUserId}`);
      if (comment) {
        console.log(`   Rejection comment: ${comment}`);
      }
      
      return updated;
    } else {
      // MR documents: MR can manage directly
      throw new Error('MR documents do not require approval/rejection workflow.');
    }
  },

  getDocument: async ({ documentId, tenantId }) => {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        currentVersion: true,
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    
    if (!document) throw new Error('Document not found');
    if (document.tenantId !== tenantId) throw new Error('Access denied');
    
    return document;
  },

  submitChangeRequest: async ({ documentId, userId, tenantId, clauseNumber, currentClause, proposedChange, justification }) => {
    // Verify document exists and user has access
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { owner: true }
    });
    
    if (!document) throw new Error('Document not found');
    if (document.tenantId !== tenantId) throw new Error('Access denied');

    // Get requesting user with department and HOD information
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userDepartmentRoles: {
          include: {
            department: {
              include: {
                hod: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!requestingUser) throw new Error('Requesting user not found');

    // Create change request in a transaction (minimal work inside transaction)
    const result = await prisma.$transaction(async (tx) => {
      const changeRequest = await tx.documentChangeRequest.create({
        data: {
          documentId,
          requestedById: userId,
          clauseNumber,
          currentClause,
          proposedChange,
          justification,
          status: 'UNDER_REVIEW',
        },
        include: {
          document: {
            include: {
              owner: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
          },
          requestedBy: { 
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              email: true,
              userDepartmentRoles: {
                include: {
                  department: true
                }
              }
            } 
          }
        }
      });

      // Create audit trail for change request submission
      await createDocumentAuditLog(tx, {
        action: 'CHANGE_REQUEST_CREATED',
        entityType: 'DOCUMENT_CHANGE_REQUEST',
        entityId: changeRequest.id,
        userId,
          tenantId,
        details: `Submitted change request for document "${document.title}" (Clause ${clauseNumber})`,
        metadata: {
          changeRequestId: changeRequest.id,
          documentId,
          documentTitle: document.title,
          clauseNumber,
          currentClause,
          proposedChange,
          justification,
          requestedBy: userId,
          status: 'UNDER_REVIEW'
        }
      });

      return changeRequest;
    }, {
      timeout: 15000 // 15 seconds timeout
    });

    // Send notifications OUTSIDE the transaction to avoid timeout
    try {
      // Use permission-based notification system instead of role-based
      const changeRequestData = {
        id: result.id,
        document: { id: documentId, title: document.title },
        clauseNumber,
        requestedBy: requestingUser,
        requestedById: userId
      };

      // Send notification to users with change request approval permission
      const notificationResult = await notificationService.sendChangeRequestNotification(
        changeRequestData,
        tenantId
      );
      
      console.log('📢 Permission-based change request notification result:', notificationResult);

      // Notify document owner about the change request (if different from requester)
      if (document.ownerId !== userId) {
        await prisma.notification.create({
          data: {
            type: 'CHANGE_REQUEST',
            title: 'Document Change Request Submitted',
            message: `A change request has been submitted for your document '${document.title}' (Clause ${clauseNumber}).`,
            tenantId,
            targetUserId: document.ownerId,
            link: `/documents/${documentId}`,
          },
        });
      }
    } catch (notificationError) {
      console.error('⚠️ Notification error (non-blocking):', notificationError);
      // Don't fail the entire operation if notifications fail
      }

    return result;
  },

  // Fetch all versions for a document
  getDocumentVersions: async ({ documentId, tenantId }) => {
    // Ensure document belongs to tenant using direct query
    const document = await prisma.document.findFirst({ 
      where: { id: documentId, tenantId } 
    });
    if (!document) throw new Error('Document not found or access denied');
    
    // Fetch all versions (including archived ones for version history)
    return prisma.documentVersion.findMany({
      where: { documentId },
      orderBy: { version: 'desc' },
      include: {
        changeRequest: {
          select: {
            id: true,
            clauseNumber: true,
            proposedChange: true,
            status: true,
            requestedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });
  },

  // Fetch all change requests for a document
  getDocumentChangeRequests: async ({ documentId, tenantId }) => {
    // Ensure document belongs to tenant using direct query
    const document = await prisma.document.findFirst({ 
      where: { id: documentId, tenantId } 
    });
    if (!document) throw new Error('Document not found or access denied');
    
    // Fetch all change requests
    return prisma.documentChangeRequest.findMany({
      where: {
        documentId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            userDepartmentRoles: {
              include: {
                department: true
              }
            }
          }
        }
      }
    });
  },

  publishDocument: async ({ documentId, userId, tenantId }) => {
    // Fetch the document with tenant validation
    const document = await prisma.document.findFirst({
      where: { id: documentId, tenantId },
      include: { owner: true }
    });
    if (!document) throw new Error('Document not found or access denied');
    if (document.status === 'PUBLISHED') throw new Error('Document is already published');
    
    // MR (Document Custodian) can publish any document in appropriate status
    if (document.type === 'AUDIT_REPORT') {
      // Audit reports are automatically published when approved by MR
      // This function should not be called for AUDIT_REPORT documents
      throw new Error('Audit reports are automatically published when approved by MR. Use the approve endpoint instead.');
    } else {
      // MR documents can be published from DRAFT or APPROVED status
      if (!['DRAFT', 'APPROVED'].includes(document.status)) {
        throw new Error('Only DRAFT or APPROVED documents can be published');
      }
    }
    
    // Update document status to PUBLISHED
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PUBLISHED' },
      include: { owner: true }
    });
    
    // Create audit trail for document publishing
    await createDocumentAuditLog(prisma, {
      action: 'PUBLISH',
      entityType: 'DOCUMENT',
      entityId: documentId,
      userId,
          tenantId,
      details: `Published document "${document.title}"`,
      metadata: {
        documentId,
        previousStatus: document.status,
        newStatus: 'PUBLISHED',
        publishedBy: userId,
        publishedAt: new Date()
      }
    });

    // Send permission-based notifications to users with document read permission
    const notificationResult = await notificationService.sendDocumentPublishedNotification(
      { id: documentId, title: document.title },
      tenantId
    );
    
    console.log(`📢 Permission-based notification result for document publish:`, notificationResult);
    
    return updatedDocument;
  },

  searchDocuments: async (where) => {
    return prisma.document.findMany({
      where,
      include: {
        currentVersion: true,
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  // Add a new method for HOD approval of change requests
  approveChangeRequestByHOD: async ({ changeRequestId, hodId, tenantId, comment }) => {
    // 1. Find the change request and ensure it is under review
    const changeRequest = await prisma.documentChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        document: true,
        requestedBy: {
          include: {
            userDepartmentRoles: {
              include: {
                department: true
              }
            }
          }
        }
      }
    });
    if (!changeRequest) throw new Error('Change request not found');
    if (changeRequest.status !== 'UNDER_REVIEW') throw new Error('Change request is not under review');
    // 2. Update status to APPROVED
    const updatedChangeRequest = await prisma.documentChangeRequest.update({
      where: { id: changeRequestId },
      data: {
        status: 'APPROVED',
        reviewedById: hodId,
        reviewComment: comment || null,
        reviewedAt: new Date(),
      },
      include: { document: true }
    });
    // 3. Use permission-based notification for change request approval
    const changeRequestData = {
      id: changeRequestId,
      document: { 
        id: updatedChangeRequest.documentId, 
        title: updatedChangeRequest.document.title 
      },
      clauseNumber: updatedChangeRequest.clauseNumber,
      approvedBy: hodId,
      approvedAt: new Date()
    };

    // Send notification to users with document change request apply permission
    const notificationResult = await notificationService.sendChangeRequestApprovalNotification(
      changeRequestData,
      tenantId
    );
    
    console.log('📢 Permission-based change request approval notification result:', notificationResult);
    // Create audit trail for change request approval
    await createDocumentAuditLog(prisma, {
      action: 'CHANGE_REQUEST_APPROVED',
      entityType: 'DOCUMENT_CHANGE_REQUEST',
      entityId: changeRequestId,
      userId: hodId,
          tenantId,
      details: `Approved change request for document "${updatedChangeRequest.document.title}" (Clause ${updatedChangeRequest.clauseNumber})`,
      metadata: {
        changeRequestId,
        documentId: updatedChangeRequest.documentId,
        documentTitle: updatedChangeRequest.document.title,
        clauseNumber: updatedChangeRequest.clauseNumber,
        approvedBy: hodId,
        approvedAt: new Date(),
        reviewComment: comment || null,
        previousStatus: 'UNDER_REVIEW',
        newStatus: 'APPROVED'
      }
    });

    return updatedChangeRequest;
  },

  archiveDocument: async ({ documentId, userId, tenantId }) => {
    // Fetch the document with tenant validation
    const document = await prisma.document.findFirst({
      where: { id: documentId, tenantId },
      include: { owner: true }
    });
    if (!document) throw new Error('Document not found or access denied');
    if (document.status === 'OBSOLETE') throw new Error('Document is already archived');
    // Only allow owner or MR to archive
    // (Optional: add more permission logic here)
    // If you want to restrict, uncomment below:
    // if (document.ownerId !== userId) throw new Error('Only the document owner can archive this document');
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: { status: 'OBSOLETE' },
      include: { owner: true }
    });

    // Create audit trail for document archiving
    await createDocumentAuditLog(prisma, {
      action: 'ARCHIVE',
      entityType: 'DOCUMENT',
      entityId: documentId,
      userId,
      tenantId,
      details: `Archived document "${updatedDocument.title}"`,
      metadata: {
        documentId,
        documentTitle: updatedDocument.title,
        previousStatus: 'PUBLISHED',
        newStatus: 'OBSOLETE',
        archivedBy: userId,
        archivedAt: new Date()
      }
    });

    return updatedDocument;
  },

  deleteDocument: async ({ documentId, userId, tenantId, userRole }) => {
    // Fetch the document with tenant validation
    const document = await prisma.document.findFirst({
      where: { id: documentId, tenantId },
      include: { 
        owner: true, 
        currentVersion: true,
        audit: { select: { id: true, auditNo: true, type: true } }
      }
    });
    
    if (!document) throw new Error('Document not found or access denied');
    
    // Only allow document owner or MR to delete
    if (document.ownerId !== userId && userRole !== 'MR') {
      throw new Error('Only the document owner or MR can delete this document');
    }
    
    // For AUDIT_REPORT documents, also clear any audit.reportGenerated flag if it exists
    if (document.type === 'AUDIT_REPORT' && document.auditId) {
      console.log(`🗑️  Deleting AUDIT_REPORT document: ${document.title}`);
      console.log(`   Audit ID: ${document.auditId}`);
      console.log(`   Deleted by: ${userRole} (${userId})`);
      
      // You might want to add logic here to clear any audit.reportGenerated flag
      // This would allow the audit to generate a new report
      // await prisma.audit.update({
      //   where: { id: document.auditId },
      //   data: { reportGenerated: false }
      // });
    }
    
    // Delete the document and all related data in a transaction
    await prisma.$transaction(async (tx) => {
      // Create audit trail for document deletion
      await createDocumentAuditLog(tx, {
        action: 'DELETE',
        entityType: 'DOCUMENT',
        entityId: documentId,
        userId,
        tenantId,
        details: `Deleted document "${document.title}" and all related data`,
        metadata: {
          documentId,
          documentTitle: document.title,
          documentType: document.type,
          deletedBy: userId,
          deletedAt: new Date(),
          relatedDataDeleted: {
            versions: true,
            changeRequests: true,
            approvals: true
          }
        }
      });

      // Delete document versions first (due to foreign key constraints)
      if (document.currentVersion) {
        await tx.documentVersion.delete({
          where: { id: document.currentVersion.id }
        });
      }
      
      // Delete all document versions for this document
      await tx.documentVersion.deleteMany({
        where: { documentId }
      });
      
      // Delete all change requests for this document
      await tx.documentChangeRequest.deleteMany({
        where: { documentId }
      });
      
      // Delete the document itself
      await tx.document.delete({
        where: { id: documentId }
      });
    }, {
      timeout: 15000 // 15 seconds timeout
    });
    
    console.log(`✅ Document "${document.title}" deleted successfully`);
    return { success: true, documentTitle: document.title };
  },

  /**
   * Get comprehensive audit trail for a document
   * @param {string} documentId - Document ID
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Complete audit trail
   */
  getDocumentAuditTrail: async ({ documentId, tenantId }) => {
    try {
      // Verify document exists and belongs to tenant
      const document = await prisma.document.findFirst({
        where: { id: documentId, tenantId },
        include: { owner: { select: { id: true, firstName: true, lastName: true, email: true } } }
      });

      if (!document) {
        throw new Error('Document not found or access denied');
      }

      // Get all audit logs related to this document
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          OR: [
            { entityType: 'DOCUMENT', entityId: documentId },
            { entityType: 'DOCUMENT_VERSION', entityId: { startsWith: documentId } },
            { entityType: 'DOCUMENT_CHANGE_REQUEST', entityId: { startsWith: documentId } }
          ],
          tenantId
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Get document versions for version history
      const versions = await prisma.documentVersion.findMany({
        where: { documentId },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          changeRequest: {
            include: {
              requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
          }
        },
        orderBy: { version: 'desc' }
      });

      // Get change requests for this document
      const changeRequests = await prisma.documentChangeRequest.findMany({
        where: { documentId },
        include: {
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });

      return {
        document: {
          id: document.id,
          title: document.title,
          type: document.type,
          status: document.status,
          owner: document.owner,
          createdAt: document.createdAt,
          updatedAt: document.updatedAt
        },
        auditTrail: {
          logs: auditLogs,
          versions: versions,
          changeRequests: changeRequests,
          summary: {
            totalActions: auditLogs.length,
            totalVersions: versions.length,
            totalChangeRequests: changeRequests.length,
            lastModified: auditLogs[0]?.createdAt || document.updatedAt
          }
        }
      };
    } catch (error) {
      console.error('[DOCUMENT_SERVICE] Error getting document audit trail:', error);
      throw error;
    }
  },

  /**
   * Get audit trail for all documents in a tenant
   * @param {string} tenantId - Tenant ID
   * @param {Object} filters - Optional filters
   * @returns {Object} Audit trail summary
   */
  getTenantDocumentAuditTrail: async ({ tenantId, filters = {} }) => {
    try {
      const { startDate, endDate, action, entityType, userId } = filters;

      // Build where clause
      const where = {
        tenantId,
        entityType: { in: ['DOCUMENT', 'DOCUMENT_VERSION', 'DOCUMENT_CHANGE_REQUEST'] }
      };

      if (startDate) where.createdAt = { gte: new Date(startDate) };
      if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (userId) where.userId = userId;

      // Get audit logs with pagination
      const auditLogs = await prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 100 // Limit to last 100 actions
      });

      // Get summary statistics
      const summary = await prisma.auditLog.groupBy({
        by: ['action', 'entityType'],
        where: { tenantId, entityType: { in: ['DOCUMENT', 'DOCUMENT_VERSION', 'DOCUMENT_CHANGE_REQUEST'] } },
        _count: { id: true }
      });

      return {
        auditLogs,
        summary: {
          totalActions: auditLogs.length,
          actionBreakdown: summary.reduce((acc, item) => {
            const key = `${item.entityType}:${item.action}`;
            acc[key] = item._count.id;
            return acc;
          }, {}),
          dateRange: { startDate, endDate }
        }
      };
    } catch (error) {
      console.error('[DOCUMENT_SERVICE] Error getting tenant document audit trail:', error);
      throw error;
    }
  }
};

module.exports = documentService;