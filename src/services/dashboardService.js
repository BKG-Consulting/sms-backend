const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger');

const dashboardService = {
  getDashboardMetrics: async () => {
    try {
      logger.info('Fetching dashboard metrics...');
      
      const [
        totalTenants,
        totalUsers,
        activeUsers,
        newClients,
        recentTenants,
        userGrowth,
        tenantGrowth
      ] = await Promise.all([
        // Total tenants
        prisma.tenant.count(),
        
        // Total users
        prisma.user.count(),
        
        // Active users (verified)
        prisma.user.count({ 
          where: { 
            verified: true 
          } 
        }),
        
        // New clients (tenants created in last 30 days)
        prisma.tenant.count({
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
            }
          }
        }),
        
        // Recent tenants (last 5)
        prisma.tenant.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: {
                users: true,
                departments: true,
                campuses: true
              }
            }
          }
        }),
        
        // User growth over time (last 6 months)
        prisma.user.groupBy({
          by: ['createdAt'],
          where: {
            createdAt: {
              gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) // 6 months ago
            }
          },
          _count: {
            id: true
          }
        }),
        
        // Tenant growth over time (last 6 months)
        prisma.tenant.groupBy({
          by: ['createdAt'],
          where: {
            createdAt: {
              gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) // 6 months ago
            }
          },
          _count: {
            id: true
          }
        })
      ]);

      logger.info('Dashboard metrics fetched successfully', {
        totalTenants,
        totalUsers,
        activeUsers,
        newClients
      });

      return {
        totalTenants,
        totalUsers,
        activeUsers,
        newClients,
        recentTenants,
        userGrowth,
        tenantGrowth
      };
    } catch (error) {
      logger.error('Error fetching dashboard metrics:', error);
      throw error;
    }
  },

  getTenantDetails: async (tenantId) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          _count: {
            select: {
              users: true,
              departments: true,
              campuses: true
            }
          },
          users: {
            take: 10,
            orderBy: {
              createdAt: 'desc'
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              verified: true,
              createdAt: true
            }
          }
        }
      });

      return tenant;
    } catch (error) {
      logger.error('Error fetching tenant details:', error);
      throw error;
    }
  },

  getSystemAdminDashboard: async (tenantId) => {
    try {
      logger.info('Fetching system admin dashboard metrics for tenant:', tenantId);
      
      const [
        totalUsers,
        activeUsers,
        totalDepartments,
        totalCampuses,
        recentUsers
      ] = await Promise.all([
        // Total users in tenant
        prisma.user.count({ where: { tenantId } }),
        
        // Active users in tenant (verified)
        prisma.user.count({ 
          where: { 
            tenantId,
            verified: true 
          } 
        }),
        
        // Department count in tenant
        prisma.department.count({ where: { tenantId } }),
        
        // Campus count in tenant
        prisma.campus.count({ where: { tenantId } }),
        
        // Recent users in tenant (last 10)
        prisma.user.findMany({
          where: { tenantId },
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            verified: true,
            createdAt: true,
            userDepartmentRoles: {
              select: {
                department: {
                  select: {
                    id: true,
                    name: true
                  }
                },
                role: {
                  select: {
                    id: true,
                    name: true
                  }
                },
                isPrimaryDepartment: true,
                isPrimaryRole: true
              }
            }
          }
        })
      ]);

      logger.info('System admin dashboard metrics fetched successfully', {
        tenantId,
        totalUsers,
        activeUsers,
        totalDepartments,
        totalCampuses
      });

      return {
        totalUsers,
        activeUsers,
        totalDepartments,
        totalCampuses,
        recentUsers: recentUsers.map(user => {
          // Pick the first department/role (or null)
          const udr = user.userDepartmentRoles && user.userDepartmentRoles.length > 0 ? user.userDepartmentRoles[0] : null;
          return {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            verified: user.verified,
            createdAt: user.createdAt,
            department: udr && udr.department ? { id: udr.department.id, name: udr.department.name } : null,
            role: udr && udr.role ? { id: udr.role.id, name: udr.role.name } : null,
            isPrimaryDepartment: udr ? udr.isPrimaryDepartment : false,
            isPrimaryRole: udr ? udr.isPrimaryRole : false
          };
        })
      };
    } catch (error) {
      logger.error('Error fetching system admin dashboard metrics:', error);
      throw error;
    }
  },

  // New methods for chart data
  getUserGrowthData: async (timeFrame = 'monthly') => {
    try {
      logger.info('Fetching user growth data for timeFrame:', timeFrame);
      
      let dateFilter;
      let groupBy;
      
      if (timeFrame === 'yearly') {
        dateFilter = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000); // 5 years
        groupBy = 'year';
      } else {
        dateFilter = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000); // 12 months
        groupBy = 'month';
      }

      const userData = await prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: dateFilter
          }
        },
        _count: {
          id: true
        }
      });

      const verifiedUserData = await prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: dateFilter
          },
          verified: true
        },
        _count: {
          id: true
        }
      });

      // Process data for chart format
      const processedData = {
        totalUsers: userData.map(item => ({
          x: new Date(item.createdAt).toLocaleDateString('en-US', { 
            month: groupBy === 'month' ? 'short' : undefined,
            year: groupBy === 'year' ? 'numeric' : undefined
          }),
          y: item._count.id
        })),
        activeUsers: verifiedUserData.map(item => ({
          x: new Date(item.createdAt).toLocaleDateString('en-US', { 
            month: groupBy === 'month' ? 'short' : undefined,
            year: groupBy === 'year' ? 'numeric' : undefined
          }),
          y: item._count.id
        }))
      };

      logger.info('User growth data processed successfully');
      return processedData;
    } catch (error) {
      logger.error('Error fetching user growth data:', error);
      throw error;
    }
  },

  // New methods for system admin chart data (tenant-scoped)
  getSystemAdminUserGrowthData: async (tenantId, timeFrame = 'monthly') => {
    try {
      logger.info('Fetching system admin user growth data for tenant:', tenantId, 'timeFrame:', timeFrame);
      
      let dateFilter;
      let groupBy;
      
      if (timeFrame === 'yearly') {
        dateFilter = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000); // 5 years
        groupBy = 'year';
      } else {
        dateFilter = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000); // 12 months
        groupBy = 'month';
      }

      const userData = await prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          tenantId,
          createdAt: {
            gte: dateFilter
          }
        },
        _count: {
          id: true
        }
      });

      const verifiedUserData = await prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          tenantId,
          createdAt: {
            gte: dateFilter
          },
          verified: true
        },
        _count: {
          id: true
        }
      });

      // Process data for chart format
      const processedData = {
        totalUsers: userData.map(item => ({
          x: new Date(item.createdAt).toLocaleDateString('en-US', { 
            month: groupBy === 'month' ? 'short' : undefined,
            year: groupBy === 'year' ? 'numeric' : undefined
          }),
          y: item._count.id
        })),
        activeUsers: verifiedUserData.map(item => ({
          x: new Date(item.createdAt).toLocaleDateString('en-US', { 
            month: groupBy === 'month' ? 'short' : undefined,
            year: groupBy === 'year' ? 'numeric' : undefined
          }),
          y: item._count.id
        }))
      };

      logger.info('System admin user growth data processed successfully');
      return processedData;
    } catch (error) {
      logger.error('Error fetching system admin user growth data:', error);
      throw error;
    }
  },

  getSystemAdminDepartmentActivityData: async (tenantId, timeFrame = 'this week') => {
    try {
      logger.info('Fetching system admin department activity data for tenant:', tenantId, 'timeFrame:', timeFrame);
      
      let dateFilter;
      if (timeFrame === 'last week') {
        dateFilter = {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)    // 7 days ago
        };
      } else {
        dateFilter = {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)   // 7 days ago
        };
      }

      // Get department and campus counts
      const [departments, campuses] = await Promise.all([
        prisma.department.count({ where: { tenantId } }),
        prisma.campus.count({ where: { tenantId } })
      ]);

      // Get user counts by department
      const usersByDepartment = await prisma.department.findMany({
        where: { tenantId },
        select: {
          name: true,
          _count: {
            select: {
              userDepartmentRoles: true
            }
          }
        }
      });

      // Get user counts by campus
      const usersByCampus = await prisma.campus.findMany({
        where: { tenantId },
        select: {
          name: true,
          _count: {
            select: {
              users: true
            }
          }
        }
      });

      // Process data for chart format
      const processedData = {
        departments: usersByDepartment.map(dept => ({
          x: dept.name,
          y: dept._count.userDepartmentRoles
        })),
        campuses: usersByCampus.map(campus => ({
          x: campus.name,
          y: campus._count.users
        }))
      };

      logger.info('System admin department activity data processed successfully');
      return processedData;
    } catch (error) {
      logger.error('Error fetching system admin department activity data:', error);
      throw error;
    }
  },

  getTenantActivityData: async (timeFrame = 'this week') => {
    try {
      logger.info('Fetching tenant activity data for timeFrame:', timeFrame);
      
      let dateFilter;
      if (timeFrame === 'last week') {
        dateFilter = {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)    // 7 days ago
        };
      } else {
        dateFilter = {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)   // 7 days ago
        };
      }

      const [
        newTenants,
        activeTenants,
        newDepartments,
        newCampuses
      ] = await Promise.all([
        // New tenants created
        prisma.tenant.count({
          where: {
            createdAt: dateFilter
          }
        }),
        
        // Active tenants (status = ACTIVE)
        prisma.tenant.count({
          where: {
            status: 'ACTIVE'
          }
        }),
        
        // New departments created
        prisma.department.count({
          where: {
            createdAt: dateFilter
          }
        }),
        
        // New campuses created
        prisma.campus.count({
          where: {
            createdAt: dateFilter
          }
        })
      ]);

      const processedData = {
        newTenants: [
          { x: 'New Tenants', y: newTenants }
        ],
        activeTenants: [
          { x: 'Active Tenants', y: activeTenants }
        ],
        newDepartments: [
          { x: 'New Departments', y: newDepartments }
        ],
        newCampuses: [
          { x: 'New Campuses', y: newCampuses }
        ]
      };

      logger.info('Tenant activity data processed successfully');
      return processedData;
    } catch (error) {
      logger.error('Error fetching tenant activity data:', error);
      throw error;
    }
  },

  // MR-specific dashboard methods
  getMRDashboard: async (tenantId) => {
    try {
      logger.info('Fetching MR dashboard metrics for tenant:', tenantId);
      
      const [
        totalAuditPrograms,
        activeAuditPrograms,
        totalAudits,
        completedAudits,
        pendingAudits,
        totalDocuments,
        documentsUnderReview,
        changeRequests,
        pendingChangeRequests,
        recentAuditPrograms,
        upcomingAudits
      ] = await Promise.all([
        // Total audit programs
        prisma.auditProgram.count({ where: { tenantId } }),
        
        // Active audit programs (APPROVED status)
        prisma.auditProgram.count({ 
          where: { 
            tenantId,
            status: 'APPROVED'
          } 
        }),
        
        // Total audits
        prisma.audit.count({
          where: {
            auditProgram: {
              tenantId
            }
          }
        }),
        
        // Completed audits
        prisma.audit.count({
          where: {
            auditProgram: {
              tenantId
            },
            status: 'COMPLETED'
          }
        }),
        
        // Pending audits (OPEN status)
        prisma.audit.count({
          where: {
            auditProgram: {
              tenantId
            },
            status: 'OPEN'
          }
        }),
        
        // Total documents
        prisma.document.count({ where: { tenantId } }),
        
        // Documents under review
        prisma.document.count({ 
          where: { 
            tenantId,
            status: 'UNDER_REVIEW'
          } 
        }),
        
        // Total change requests
        prisma.documentChangeRequest.count({
          where: {
            document: {
              tenantId
            }
          }
        }),
        
        // Pending change requests
        prisma.documentChangeRequest.count({
          where: {
            document: {
              tenantId
            },
            status: 'UNDER_REVIEW'
          }
        }),
        
        // Recent audit programs (last 5)
        prisma.auditProgram.findMany({
          where: { tenantId },
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            },
            _count: {
              select: {
                audits: true
              }
            }
          }
        }),
        
        // Upcoming audits (next 30 days)
        prisma.audit.findMany({
          where: {
            auditProgram: {
              tenantId
            },
            auditDateFrom: {
              gte: new Date(),
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Next 30 days
            },
            status: 'OPEN'
          },
          include: {
            auditProgram: {
              select: {
                title: true
              }
            }
          },
          orderBy: {
            auditDateFrom: 'asc'
          },
          take: 10
        })
      ]);

      logger.info('MR dashboard metrics fetched successfully', {
        tenantId,
        totalAuditPrograms,
        activeAuditPrograms,
        totalAudits,
        completedAudits,
        pendingAudits,
        totalDocuments,
        documentsUnderReview,
        changeRequests,
        pendingChangeRequests
      });

      return {
        totalAuditPrograms,
        activeAuditPrograms,
        totalAudits,
        completedAudits,
        pendingAudits,
        totalDocuments,
        documentsUnderReview,
        changeRequests,
        pendingChangeRequests,
        recentAuditPrograms,
        upcomingAudits
      };
    } catch (error) {
      logger.error('Error fetching MR dashboard metrics:', error);
      throw error;
    }
  },

  getMRAuditProgramGrowthData: async (tenantId, timeFrame = 'monthly') => {
    try {
      logger.info('Fetching MR audit program growth data for tenant:', tenantId, 'timeFrame:', timeFrame);
      
      let dateFilter;
      let groupBy;
      
      if (timeFrame === 'yearly') {
        dateFilter = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000); // 5 years
        groupBy = 'year';
      } else {
        dateFilter = new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000); // 12 months
        groupBy = 'month';
      }

      const auditProgramData = await prisma.auditProgram.groupBy({
        by: ['createdAt'],
        where: {
          tenantId,
          createdAt: {
            gte: dateFilter
          }
        },
        _count: {
          id: true
        }
      });

      const approvedAuditProgramData = await prisma.auditProgram.groupBy({
        by: ['createdAt'],
        where: {
          tenantId,
          createdAt: {
            gte: dateFilter
          },
          status: 'APPROVED'
        },
        _count: {
          id: true
        }
      });

      // Process data for chart format
      const processedData = {
        totalPrograms: auditProgramData.map(item => ({
          x: new Date(item.createdAt).toLocaleDateString('en-US', { 
            month: groupBy === 'month' ? 'short' : undefined,
            year: groupBy === 'year' ? 'numeric' : undefined
          }),
          y: item._count.id
        })),
        approvedPrograms: approvedAuditProgramData.map(item => ({
          x: new Date(item.createdAt).toLocaleDateString('en-US', { 
            month: groupBy === 'month' ? 'short' : undefined,
            year: groupBy === 'year' ? 'numeric' : undefined
          }),
          y: item._count.id
        }))
      };

      logger.info('MR audit program growth data processed successfully');
      return processedData;
    } catch (error) {
      logger.error('Error fetching MR audit program growth data:', error);
      throw error;
    }
  },

  getMRAuditActivityData: async (tenantId, timeFrame = 'this week') => {
    try {
      logger.info('Fetching MR audit activity data for tenant:', tenantId, 'timeFrame:', timeFrame);
      
      let dateFilter;
      if (timeFrame === 'last week') {
        dateFilter = {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)    // 7 days ago
        };
      } else {
        dateFilter = {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)   // 7 days ago
        };
      }

      // Get audit counts by status
      const [openAudits, completedAudits, cancelledAudits] = await Promise.all([
        prisma.audit.count({
          where: {
            auditProgram: { tenantId },
            status: 'OPEN'
          }
        }),
        prisma.audit.count({
          where: {
            auditProgram: { tenantId },
            status: 'COMPLETED'
          }
        }),
        prisma.audit.count({
          where: {
            auditProgram: { tenantId },
            status: 'CANCELLED'
          }
        })
      ]);

      // Get audit counts by type
      const auditsByType = await prisma.audit.groupBy({
        by: ['type'],
        where: {
          auditProgram: { tenantId }
        },
        _count: {
          id: true
        }
      });

      // Process data for chart format
      const processedData = {
        auditStatus: [
          { x: 'Open', y: openAudits },
          { x: 'Completed', y: completedAudits },
          { x: 'Cancelled', y: cancelledAudits }
        ],
        auditTypes: auditsByType.map(audit => ({
          x: audit.type.replace(/_/g, ' '),
          y: audit._count.id
        }))
      };

      logger.info('MR audit activity data processed successfully');
      return processedData;
    } catch (error) {
      logger.error('Error fetching MR audit activity data:', error);
      throw error;
    }
  },

  getMRDocumentActivityData: async (tenantId, timeFrame = 'this week') => {
    try {
      logger.info('Fetching MR document activity data for tenant:', tenantId, 'timeFrame:', timeFrame);
      
      let dateFilter;
      if (timeFrame === 'last week') {
        dateFilter = {
          gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
          lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)    // 7 days ago
        };
      } else {
        dateFilter = {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)   // 7 days ago
        };
      }

      // Get document counts by status
      const [draftDocuments, underReviewDocuments, approvedDocuments, rejectedDocuments] = await Promise.all([
        prisma.document.count({
          where: {
            tenantId,
            status: 'DRAFT'
          }
        }),
        prisma.document.count({
          where: {
            tenantId,
            status: 'UNDER_REVIEW'
          }
        }),
        prisma.document.count({
          where: {
            tenantId,
            status: 'APPROVED'
          }
        }),
        prisma.document.count({
          where: {
            tenantId,
            status: 'REJECTED'
          }
        })
      ]);

      // Get change request counts by status
      const [pendingChangeRequests, approvedChangeRequests, rejectedChangeRequests] = await Promise.all([
        prisma.documentChangeRequest.count({
          where: {
            document: { tenantId },
            status: 'UNDER_REVIEW'
          }
        }),
        prisma.documentChangeRequest.count({
          where: {
            document: { tenantId },
            status: 'APPROVED'
          }
        }),
        prisma.documentChangeRequest.count({
          where: {
            document: { tenantId },
            status: 'REJECTED'
          }
        })
      ]);

      // Process data for chart format
      const processedData = {
        documentStatus: [
          { x: 'Draft', y: draftDocuments },
          { x: 'Under Review', y: underReviewDocuments },
          { x: 'Approved', y: approvedDocuments },
          { x: 'Rejected', y: rejectedDocuments }
        ],
        changeRequestStatus: [
          { x: 'Pending', y: pendingChangeRequests },
          { x: 'Approved', y: approvedChangeRequests },
          { x: 'Rejected', y: rejectedChangeRequests }
        ]
      };

      logger.info('MR document activity data processed successfully');
      return processedData;
    } catch (error) {
      logger.error('Error fetching MR document activity data:', error);
      throw error;
    }
  },

  // Auditor Dashboard Methods
  getAuditorDashboard: async (tenantId, userId) => {
    try {
      const [
        auditAssignments,
        planningMeetings,
        auditPlans,
        findings,
        correctiveActions,
        checklists,
        notifications
      ] = await Promise.all([
        // Get audit assignments for the auditor
        prisma.auditTeamMember.findMany({
          where: {
            userId,
            audit: { auditProgram: { tenantId } }
          },
          include: {
            audit: {
              include: {
                auditProgram: { select: { id: true, title: true, status: true } },
                teamMembers: {
                  include: { user: { select: { firstName: true, lastName: true, email: true } } }
                }
              }
            }
          },
          orderBy: { appointedAt: 'desc' }
        }),

        // Get planning meetings where auditor is involved
        prisma.auditPlanningMeeting.findMany({
          where: {
            audit: { 
              auditProgram: { tenantId },
              teamMembers: { some: { userId } }
            }
          },
          include: {
            audit: { 
              select: { 
                id: true,
                auditNo: true, 
                auditProgramId: true,
                auditProgram: { select: { id: true, title: true } }
              } 
            },
            attendances: { include: { user: { select: { firstName: true, lastName: true } } } },
            agendas: true
          },
          orderBy: { scheduledAt: 'desc' }
        }),

        // Get audit plans created by or assigned to the auditor
        prisma.auditPlan.findMany({
          where: {
            OR: [
              { createdById: userId },
              { 
                audit: { 
                  auditProgram: { tenantId },
                  teamMembers: { some: { userId } }
                }
              }
            ]
          },
          include: {
            audit: {
              select: {
                auditNo: true,
                auditProgram: { select: { title: true } },
                checklists: {
                  include: {
                    items: { where: { completed: true } }
                  }
                },
                findings: {
                  include: {
                    nonConformities: {
                      include: {
                        correctiveActions: true
                      }
                    }
                  }
                }
              }
            }
            // Removed nonConformities and correctiveActions from here
          },
          orderBy: { createdAt: 'desc' }
        }),

        // Get findings created by the auditor
        prisma.auditFinding.findMany({
          where: {
            createdById: userId,
            audit: { auditProgram: { tenantId } }
          },
          include: {
            audit: {
              select: {
                auditNo: true,
                auditProgram: { select: { title: true } }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),

        // Get corrective actions assigned to or created by the auditor
        prisma.correctiveAction.findMany({
          where: {
            OR: [
              { assignedToId: userId },
              { createdById: userId }
            ],
            nonConformity: {
              finding: {
                audit: {
                  auditProgram: { tenantId }
                }
              }
            }
          },
          include: {
            nonConformity: {
              include: {
                finding: {
                  include: {
                    audit: {
                      select: {
                        auditNo: true,
                        auditProgram: { select: { title: true } }
                      }
                    }
                  }
                }
              }
            },
            assignedTo: { select: { firstName: true, lastName: true, email: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),

        // Get checklists created by or assigned to the auditor
        prisma.checklist.findMany({
          where: {
            audit: {
              auditProgram: { tenantId }
            },
            OR: [
              { createdById: userId },
              { assignees: { some: { userId } } }
            ]
          },
          include: {
            audit: {
              select: {
                auditNo: true,
                auditProgram: { select: { title: true } }
              }
            },
            items: true,
            assignees: { include: { user: true } }
          },
          orderBy: { createdAt: 'desc' }
        }),

        // Get notifications for the auditor
        prisma.notification.findMany({
          where: {
            targetUserId: userId,
            tenantId,
            isRead: false
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        })
      ]);

      // Calculate metrics
      const totalAssignments = auditAssignments.length;
      const activeAssignments = auditAssignments.filter(a => 
        a.audit.auditProgram.status === 'APPROVED' && a.status === 'ACCEPTED'
      ).length;
      
      const totalFindings = findings.length;
      const openFindings = findings.filter(f => f.status === 'OPEN').length;
      const criticalFindings = findings.filter(f => f.severity === 'CRITICAL').length;
      
      const totalCorrectiveActions = correctiveActions.length;
      const openActions = correctiveActions.filter(a => a.status === 'OPEN').length;
      const overdueActions = correctiveActions.filter(a => 
        a.dueDate && new Date(a.dueDate) < new Date() && a.status !== 'COMPLETED'
      ).length;
      
      const totalChecklists = checklists.length;
      const completedChecklists = checklists.filter(c => 
        c.items.length > 0 && c.items.every(item => item.completed)
      ).length;
      
      const upcomingMeetings = planningMeetings.filter(m => 
        new Date(m.scheduledAt) > new Date()
      ).length;

      return {
        // Overview metrics
        totalAssignments: { value: totalAssignments, growthRate: 0 },
        activeAssignments: { value: activeAssignments, growthRate: 0 },
        totalFindings: { value: totalFindings, growthRate: 0 },
        openFindings: { value: openFindings, growthRate: 0 },
        criticalFindings: { value: criticalFindings, growthRate: 0 },
        totalCorrectiveActions: { value: totalCorrectiveActions, growthRate: 0 },
        openActions: { value: openActions, growthRate: 0 },
        overdueActions: { value: overdueActions, growthRate: 0 },
        totalChecklists: { value: totalChecklists, growthRate: 0 },
        completedChecklists: { value: completedChecklists, growthRate: 0 },
        upcomingMeetings: { value: upcomingMeetings, growthRate: 0 },
        unreadNotifications: { value: notifications.length, growthRate: 0 },

        // Detailed data
        auditAssignments,
        planningMeetings,
        auditPlans,
        findings,
        correctiveActions,
        checklists,
        notifications
      };
    } catch (error) {
      logger.error('Error fetching auditor dashboard data:', error);
      throw error;
    }
  },

  getAuditorAssignments: async (tenantId, userId) => {
    try {
      return await prisma.auditTeamMember.findMany({
        where: {
          userId,
          audit: { auditProgram: { tenantId } }
        },
        include: {
          audit: {
            include: {
              auditProgram: { select: { title: true, status: true } },
              teamMembers: {
                include: { user: { select: { firstName: true, lastName: true, email: true } } }
              }
            }
          }
        },
        orderBy: { appointedAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching auditor assignments:', error);
      throw error;
    }
  },

  getAuditorFindings: async (tenantId, userId) => {
    try {
      return await prisma.auditFinding.findMany({
        where: {
          createdById: userId,
          audit: { auditProgram: { tenantId } }
        },
        include: {
          audit: {
            select: {
              auditNo: true,
              auditProgram: { select: { title: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching auditor findings:', error);
      throw error;
    }
  },

  getAuditorCorrectiveActions: async (tenantId, userId) => {
    try {
      return await prisma.correctiveAction.findMany({
        where: {
          OR: [
            { assignedToId: userId },
            { createdById: userId }
          ],
          nonConformity: {
            finding: {
              audit: {
                auditProgram: { tenantId }
              }
            }
          }
        },
        include: {
          nonConformity: {
            include: {
              finding: {
                include: {
                  audit: {
                    select: {
                      auditNo: true,
                      auditProgram: { select: { title: true } }
                    }
                  }
                }
              }
            }
          },
          assignedTo: { select: { firstName: true, lastName: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching auditor corrective actions:', error);
      throw error;
    }
  },

  getAuditorChecklists: async (tenantId, userId) => {
    try {
      return await prisma.checklist.findMany({
        where: {
          audit: {
            auditProgram: { tenantId }
          },
          OR: [
            { createdById: userId },
            { assignees: { some: { userId } } }
          ]
        },
        include: {
          audit: {
            select: {
              auditNo: true,
              auditProgram: { select: { title: true } }
            }
          },
          items: true,
          assignees: { include: { user: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching auditor checklists:', error);
      throw error;
    }
  },

  getAuditorPlanningMeetings: async (tenantId, userId) => {
    try {
      return await prisma.auditPlanningMeeting.findMany({
        where: {
          audit: { 
            auditProgram: { tenantId },
            teamMembers: { some: { userId } }
          }
        },
        include: {
          audit: { select: { auditNo: true, auditProgram: { select: { title: true } } } },
          attendances: { include: { user: { select: { firstName: true, lastName: true } } } },
          agendas: true
        },
        orderBy: { scheduledAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching auditor planning meetings:', error);
      throw error;
    }
  }
};

module.exports = dashboardService; 