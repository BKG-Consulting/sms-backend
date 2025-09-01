const { prisma } = require('../../prisma/client');
const storageService = require('../config/storage');
const notificationService = require('./notificationService');

const changeRequestService = {
  getChangeRequests: async ({ tenantId, userId, userRoles }) => {
    // Build where clause based on user role
    let whereClause = {};
    
    // Always filter by tenant through document relationship
    whereClause.document = { tenantId };
    
    // HOD can see change requests from their department
    if (userRoles.includes('HOD')) {
      const hod = await prisma.user.findUnique({
        where: { id: userId },
        include: { userDepartmentRoles: { include: { department: true } } }
      });
      if (hod?.userDepartmentRoles && hod.userDepartmentRoles.length > 0) {
        // Collect all department IDs the HOD belongs to
        const departmentIds = hod.userDepartmentRoles
          .filter(udr => udr.department)
          .map(udr => udr.department.id);
        if (departmentIds.length > 0) {
          whereClause.requestedBy = {
            userDepartmentRoles: {
              some: {
                departmentId: { in: departmentIds }
              }
            }
          };
        }
      }
    }
    
    // Principal can see all approved change requests (HOD approval is tracked in DocumentApproval)
    if (userRoles.includes('Principal')) {
      whereClause.status = 'APPROVED';
    }
    
    // MR can see all approved change requests
    if (userRoles.includes('MR')) {
      whereClause.status = 'APPROVED';
    }
    
    // Regular users can only see their own change requests
    if (!userRoles.includes('HOD') && !userRoles.includes('Principal') && !userRoles.includes('MR')) {
      whereClause.requestedById = userId;
    }

    const changeRequests = await prisma.documentChangeRequest.findMany({
      where: whereClause,
      include: {
        document: {
          select: { id: true, title: true, ownerId: true }
        },
        requestedBy: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true,
            userDepartmentRoles: {
              select: {
                department: {
                  select: { id: true, name: true, code: true }
                }
              }
            }
          }
        },
        approvals: {
          include: {
            approvedBy: {
              select: { id: true, firstName: true, lastName: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Attach department as a top-level field on requestedBy for each changeRequest
    for (const cr of changeRequests) {
      const deptRole = cr.requestedBy.userDepartmentRoles?.find(udr => udr.department);
      cr.requestedBy.department = deptRole ? deptRole.department : undefined;
    }

    return changeRequests;
  },

  getChangeRequest: async ({ changeRequestId, tenantId }) => {
    const changeRequest = await prisma.documentChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        document: {
          select: { id: true, title: true, ownerId: true, tenantId: true }
        },
        requestedBy: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true,
            userDepartmentRoles: {
              select: {
                department: {
                  select: { id: true, name: true, code: true }
                }
              }
            }
          }
        },
        approvals: {
          include: {
            approvedBy: {
              select: { id: true, firstName: true, lastName: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!changeRequest) throw new Error('Change request not found');
    if (changeRequest.document.tenantId !== tenantId) throw new Error('Access denied');

    // Attach department as a top-level field on requestedBy
    const deptRole = changeRequest.requestedBy.userDepartmentRoles?.find(udr => udr.department);
    changeRequest.requestedBy.department = deptRole ? deptRole.department : undefined;

    return changeRequest;
  },

  approveChangeRequest: async ({ changeRequestId, hodId, tenantId, comment, reqUser }) => {
    // Check if user has permission to approve change requests
    const user = await prisma.user.findFirst({
      where: {
        id: reqUser.userId,
        tenantId
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        },
        userDepartmentRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has documentChangeRequest:approve permission
    const hasApprovePermission = user.userRoles.some(ur => 
      ur.role.rolePermissions.some(rp => 
        rp.permission.module === 'documentChangeRequest' && 
        rp.permission.action === 'approve' && 
        rp.allowed
      )
    ) || user.userDepartmentRoles.some(udr => 
      udr.role.rolePermissions.some(rp => 
        rp.permission.module === 'documentChangeRequest' && 
        rp.permission.action === 'approve' && 
        rp.allowed
      )
    );

    if (!hasApprovePermission) {
      throw new Error('You do not have permission to approve change requests');
    }
    // Fetch the HOD user and their headed departments
    const hod = await prisma.user.findUnique({
      where: { id: reqUser.userId },
      include: { headedDepartments: true }
    });
    if (!hod) throw new Error('HOD not found');

    const changeRequest = await prisma.documentChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        document: { select: { id: true, title: true, tenantId: true } },
        requestedBy: {
          include: {
            userDepartmentRoles: { include: { department: true } }
          }
        }
      }
    });
    if (!changeRequest) throw new Error('Change request not found');
    if (changeRequest.document.tenantId !== tenantId) throw new Error('Access denied');
    if (changeRequest.status !== 'UNDER_REVIEW') throw new Error('Change request is not in review status');
    // Find the requester's department
    const requesterDept = changeRequest.requestedBy.userDepartmentRoles.find(udr => udr.department)?.department;
    if (!requesterDept) throw new Error('Requester is not assigned to a department');
    // Check if the HOD/HOD AUDITOR is the actual HOD for the requester's department
    if (!hod.headedDepartments.some(dept => dept.id === requesterDept.id)) {
      throw new Error('You can only approve change requests from departments where you are the HOD or HOD AUDITOR');
    }

    // Update change request status and create approval record
    const result = await prisma.$transaction(async (tx) => {
      const updatedChangeRequest = await tx.documentChangeRequest.update({
        where: { id: changeRequestId },
        data: { status: 'APPROVED' },
        include: {
          document: { select: { id: true, title: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });
      await tx.documentApproval.create({
        data: {
          documentId: changeRequest.documentId,
          changeRequestId,
          approvedById: reqUser.userId,
          status: 'APPROVED',
          comment
        }
      });
      return updatedChangeRequest;
    });

    // Send permission-based notifications
    try {
      // Notify users with document publish permission (MRs and others who can publish)
      const publishNotificationResult = await notificationService.sendChangeRequestApprovalNotification(
        { 
          id: changeRequestId,
          document: { id: changeRequest.documentId, title: changeRequest.document.title },
          clauseNumber: changeRequest.clauseNumber
        },
        tenantId
      );
      
      // Notify the requester about the approval
      await prisma.notification.create({
        data: {
          type: 'CHANGE_REQUEST_APPROVED',
          title: 'Change Request Approved',
          message: `Your change request for document '${changeRequest.document.title}' (Clause ${changeRequest.clauseNumber}) has been approved by your HOD and is now ready for implementation by the MR.`,
          tenantId,
          targetUserId: changeRequest.requestedById,
          link: `/documents/${changeRequest.documentId}?tab=changeRequests&cr=${changeRequestId}`,
        }
      });
      
      console.log(`📢 Permission-based notification result for change request approval:`, publishNotificationResult);
    } catch (notificationError) {
      console.error('Failed to create permission-based notifications:', notificationError);
      // Don't fail the entire operation if notifications fail
    }

    return result;
  },

  rejectChangeRequest: async ({ changeRequestId, hodId, tenantId, comment, reqUser }) => {
    // Check if user has permission to reject change requests
    const user = await prisma.user.findFirst({
      where: {
        id: reqUser.userId,
        tenantId
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        },
        userDepartmentRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has documentChangeRequest:reject permission
    const hasRejectPermission = user.userRoles.some(ur => 
      ur.role.rolePermissions.some(rp => 
        rp.permission.module === 'documentChangeRequest' && 
        rp.permission.action === 'reject' && 
        rp.allowed
      )
    ) || user.userDepartmentRoles.some(udr => 
      udr.role.rolePermissions.some(rp => 
        rp.permission.module === 'documentChangeRequest' && 
        rp.permission.action === 'reject' && 
        rp.allowed
      )
    );

    if (!hasRejectPermission) {
      throw new Error('You do not have permission to reject change requests');
    }
    // Verify HOD can reject this change request
    const hod = await prisma.user.findUnique({
      where: { id: hodId },
      include: { headedDepartments: true, userDepartmentRoles: true }
    });

    if (!hod || !hod.headedDepartments || hod.headedDepartments.length === 0) throw new Error('HOD not found or not assigned to a department');

    const changeRequest = await prisma.documentChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        document: { select: { id: true, title: true, tenantId: true } },
        requestedBy: { 
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true,
            userDepartmentRoles: {
              select: {
                department: { select: { id: true, name: true } }
              }
            }
          }
        }
      }
    });

    if (!changeRequest) throw new Error('Change request not found');
    if (changeRequest.document.tenantId !== tenantId) throw new Error('Access denied');
    if (changeRequest.status !== 'UNDER_REVIEW') throw new Error('Change request is not in review status');
    // Find the requester's department
    const requesterDept = changeRequest.requestedBy.userDepartmentRoles.find(udr => udr.department)?.department;
    if (!requesterDept) throw new Error('Requester is not assigned to a department');
    // Check if the HOD/HOD AUDITOR is the actual HOD for the requester's department
    if (!hod.headedDepartments.some(dept => dept.id === requesterDept.id)) {
      throw new Error('You can only reject change requests from departments where you are the HOD or HOD AUDITOR');
    }

    // Update change request status and create rejection record
    const result = await prisma.$transaction(async (tx) => {
      const updatedChangeRequest = await tx.documentChangeRequest.update({
        where: { id: changeRequestId },
        data: { status: 'REJECTED' },
        include: {
          document: { select: { id: true, title: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      await tx.documentApproval.create({
        data: {
          documentId: changeRequest.documentId,
          changeRequestId,
          approvedById: hodId,
          status: 'REJECTED',
          comment
        }
      });

      // Note: Requester notification will be handled outside the transaction using permission-based service

      return updatedChangeRequest;
    });

    // Send permission-based rejection notification to the requester
    try {
      const rejectionNotificationResult = await notificationService.sendChangeRequestRejectionNotification(
        { 
          id: changeRequestId,
          document: { id: changeRequest.documentId, title: changeRequest.document.title },
          clauseNumber: changeRequest.clauseNumber,
          requestedById: changeRequest.requestedById
        },
        tenantId
      );
      
      console.log(`📢 Permission-based rejection notification result:`, rejectionNotificationResult);
    } catch (notificationError) {
      console.error('Failed to create permission-based rejection notification:', notificationError);
      // Don't fail the entire operation if notifications fail
    }

    return result;
  },

  verifyChangeRequest: async ({ changeRequestId, principalId, tenantId, verified, comment }) => {
    const changeRequest = await prisma.documentChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        document: { select: { id: true, title: true, tenantId: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    if (!changeRequest) throw new Error('Change request not found');
    if (changeRequest.document.tenantId !== tenantId) throw new Error('Access denied');
    if (changeRequest.status !== 'UNDER_REVIEW') throw new Error('Change request is not in review status');

    const result = await prisma.$transaction(async (tx) => {
      const updatedChangeRequest = await tx.documentChangeRequest.update({
        where: { id: changeRequestId },
        data: { 
          status: verified ? 'APPROVED' : 'REJECTED'
        },
        include: {
          document: { select: { id: true, title: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      await tx.documentApproval.create({
        data: {
          documentId: changeRequest.documentId,
          changeRequestId,
          approvedById: principalId,
          status: verified ? 'APPROVED' : 'REJECTED',
          comment
        }
      });

      return updatedChangeRequest;
    });

    // Create notifications OUTSIDE the transaction
    try {
      if (verified) {
        // Find MR role first
        const mrRole = await prisma.role.findFirst({
          where: { 
            name: 'MR',
            tenantId 
          }
        });
        
        // Notify MR about the approved change request
        const mrs = mrRole ? await prisma.user.findMany({
          where: {
            tenantId,
            OR: [
              { userRoles: { some: { roleId: mrRole.id } } },
              { userDepartmentRoles: { some: { roleId: mrRole.id } } }
            ]
          }
        }) : [];

        await Promise.all(mrs.map(mr =>
          prisma.notification.create({
            data: {
              type: 'CHANGE_REQUEST_APPROVED',
              title: 'Change Request Approved - Action Required',
              message: `A change request for document '${changeRequest.document.title}' (Clause ${changeRequest.clauseNumber}) has been approved by the Principal and is ready for implementation.`,
              tenantId,
              targetUserId: mr.id,
              link: `/documents/${changeRequest.documentId}?tab=changeRequests&cr=${changeRequestId}`,
            }
          })
        ));

        // Notify the requester about the approval
        await prisma.notification.create({
          data: {
            type: 'CHANGE_REQUEST_APPROVED',
            title: 'Change Request Fully Approved',
            message: `Your change request for document '${changeRequest.document.title}' (Clause ${changeRequest.clauseNumber}) has been approved by the Principal and is now ready for implementation by the MR.`,
            tenantId,
            targetUserId: changeRequest.requestedById,
            link: `/documents/${changeRequest.documentId}?tab=changeRequests&cr=${changeRequestId}`,
          }
        });
        
        console.log(`📢 Notified ${mrs.length} MRs and requester about change request verification`);
      } else {
        // Notify the requester about the verification decline
        await prisma.notification.create({
          data: {
            type: 'CHANGE_REQUEST_VERIFICATION_DECLINED',
            title: 'HOD Approval Declined by Principal',
            message: `Your change request for document '${changeRequest.document.title}' (Clause ${changeRequest.clauseNumber}) has been declined by the Principal.${comment ? ' Reason: ' + comment : ''}`,
            tenantId,
            targetUserId: changeRequest.requestedById,
            link: `/documents/${changeRequest.documentId}?tab=changeRequests&cr=${changeRequestId}`,
          }
        });
        
        console.log(`📢 Notified requester about change request verification decline`);
      }
    } catch (notificationError) {
      console.error('Failed to create notifications:', notificationError);
      // Don't fail the entire operation if notifications fail
    }

    return result;
  },

  applyChangeRequest: async ({ changeRequestId, mrId, tenantId, file }) => {
    const changeRequest = await prisma.documentChangeRequest.findUnique({
      where: { id: changeRequestId },
      include: {
        document: { select: { id: true, title: true, tenantId: true, currentVersionId: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    if (!changeRequest) throw new Error('Change request not found');
    if (changeRequest.document.tenantId !== tenantId) throw new Error('Access denied');
    if (changeRequest.status !== 'APPROVED') throw new Error('Change request is not approved');
    
    // Check if user has permission to apply change requests
    const user = await prisma.user.findFirst({
      where: {
        id: mrId,
        tenantId
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        },
        userDepartmentRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user has documentChangeRequest:apply permission
    const hasApplyPermission = user.userRoles.some(ur => 
      ur.role.rolePermissions.some(rp => 
        rp.permission.module === 'documentChangeRequest' && 
        rp.permission.action === 'apply' && 
        rp.allowed
      )
    ) || user.userDepartmentRoles.some(udr => 
      udr.role.rolePermissions.some(rp => 
        rp.permission.module === 'documentChangeRequest' && 
        rp.permission.action === 'apply' && 
        rp.allowed
      )
    );

    if (!hasApplyPermission) {
      throw new Error('You do not have permission to apply change requests');
    }

    // Upload file using storage service
    const fileName = `${Date.now()}_${file.originalname}`;
    const uploadResult = await storageService.uploadFile(file, fileName);
    const fileUrl = uploadResult.url;

    // Get socket.io instance for real-time notifications
    let io;
    try {
      const socketService = require('./socketService');
      io = socketService.getIO();
    } catch (error) {
      console.error('Socket service not available:', error);
      io = null;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get current version number and document details
      const currentVersion = await tx.documentVersion.findUnique({
        where: { id: changeRequest.document.currentVersionId }
      });

      const newVersionNumber = currentVersion ? currentVersion.version + 1 : 1;

      // Create new document version with change request metadata
      const versionData = {
        documentId: changeRequest.document.id,
        version: newVersionNumber,
        fileUrl,
        createdById: mrId,
        changeRequestId: changeRequestId,
        status: 'ACTIVE', // Ensure new version is ACTIVE
      };

      // Add storage-specific fields based on storage type
      if (uploadResult.storageType === 's3') {
        versionData.s3Key = fileName;
      } else if (uploadResult.storageType === 'cloudinary') {
        versionData.cloudinaryId = uploadResult.cloudinaryId;
      }

      const newVersion = await tx.documentVersion.create({
        data: versionData
      });

      // Archive the previous version by setting its status to OBSOLETE
      if (currentVersion) {
        await tx.documentVersion.update({
          where: { id: currentVersion.id },
          data: { 
            status: 'OBSOLETE'
          }
        });
        console.log(`📄 Archived previous version ${currentVersion.version} of document "${changeRequest.document.title}"`);
      }

      // Update document to use new version, set status to PUBLISHED, and track change request update
      await tx.document.update({
        where: { id: changeRequest.document.id },
        data: { 
          currentVersionId: newVersion.id,
          updatedAt: new Date(),
          lastUpdatedViaChangeRequest: new Date(),
          isRecentlyUpdated: true,
          status: 'PUBLISHED', // Ensure document is visible to all users
        }
      });

      console.log(`✅ Applied change request to document "${changeRequest.document.title}"`);
      console.log(`   New version: ${newVersionNumber}`);
      console.log(`   Previous version archived: ${currentVersion ? currentVersion.version : 'N/A'}`);

      // Update change request status to APPLIED
      const updatedChangeRequest = await tx.documentChangeRequest.update({
        where: { id: changeRequestId },
        data: { status: 'APPLIED' },
        include: {
          document: { select: { id: true, title: true } },
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      return { updatedChangeRequest, newVersionNumber };
    });

    // Send permission-based notifications to users with document read permission
    try {
      const notificationResult = await notificationService.sendDocumentPublishedNotification(
        { 
          id: changeRequest.document.id, 
          title: changeRequest.document.title 
        },
        tenantId
      );
      
      console.log(`📢 Permission-based notification result for document update:`, notificationResult);
    } catch (notificationError) {
      console.error('Failed to create permission-based notifications:', notificationError);
      // Don't fail the entire operation if notifications fail
    }

    return result.updatedChangeRequest;
  },
};

module.exports = changeRequestService;