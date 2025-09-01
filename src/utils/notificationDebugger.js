const { prisma } = require('../../prisma/client');

/**
 * Utility class for debugging notification issues
 */
class NotificationDebugger {
  
  /**
   * Debug HOD notification issues for a specific corrective action
   */
  static async debugHODNotification(correctiveActionId) {
    console.log(`🔍 [NOTIFICATION_DEBUGGER] Starting debug for corrective action: ${correctiveActionId}`);
    
    try {
      // 1. Get corrective action with full context
      const correctiveAction = await prisma.correctiveAction.findUnique({
        where: { id: correctiveActionId },
        include: {
          nonConformity: {
            include: {
              finding: {
                include: {
                  audit: {
                    include: {
                      auditProgram: {
                        select: { tenantId: true }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      if (!correctiveAction) {
        console.error(`❌ [NOTIFICATION_DEBUGGER] Corrective action not found: ${correctiveActionId}`);
        return { error: 'Corrective action not found' };
      }
      
      const finding = correctiveAction.nonConformity?.finding;
      if (!finding) {
        console.error(`❌ [NOTIFICATION_DEBUGGER] Finding not found for corrective action: ${correctiveActionId}`);
        return { error: 'Finding not found' };
      }
      
      console.log(`✅ [NOTIFICATION_DEBUGGER] Found corrective action data:`, {
        correctiveActionId,
        nonConformityId: correctiveAction.nonConformityId,
        findingId: finding.id,
        department: finding.department,
        tenantId: finding.audit?.auditProgram?.tenantId
      });
      
      // 2. Check department configuration
      const departmentDebug = await this.debugDepartment(finding.department, finding.audit?.auditProgram?.tenantId);
      
      // 3. Check notification system
      const notificationDebug = await this.debugNotificationSystem();
      
      // 4. Check socket.io status
      const socketDebug = await this.debugSocketIO();
      
      return {
        correctiveAction: {
          id: correctiveAction.id,
          status: correctiveAction.status,
          nonConformityId: correctiveAction.nonConformityId
        },
        finding: {
          id: finding.id,
          department: finding.department,
          tenantId: finding.audit?.auditProgram?.tenantId
        },
        departmentDebug,
        notificationDebug,
        socketDebug,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ [NOTIFICATION_DEBUGGER] Debug failed:`, error);
      return { error: error.message };
    }
  }
  
  /**
   * Debug department configuration
   */
  static async debugDepartment(departmentName, tenantId) {
    console.log(`🔍 [NOTIFICATION_DEBUGGER] Debugging department: "${departmentName}" in tenant: ${tenantId}`);
    
    if (!departmentName) {
      return { error: 'Department name is missing' };
    }
    
    if (!tenantId) {
      return { error: 'Tenant ID is missing' };
    }
    
    try {
      // Check if department exists
      const department = await prisma.department.findFirst({
        where: { 
          name: departmentName,
          tenantId: tenantId
        },
        include: {
          hod: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              verified: true
            }
          },
          tenant: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        }
      });
      
      if (!department) {
        console.error(`❌ [NOTIFICATION_DEBUGGER] Department not found: "${departmentName}" in tenant: ${tenantId}`);
        return {
          error: 'Department not found',
          departmentName,
          tenantId,
          suggestions: [
            'Check if department name matches exactly (case-sensitive)',
            'Verify tenant ID is correct',
            'Ensure department exists in the database'
          ]
        };
      }
      
      console.log(`✅ [NOTIFICATION_DEBUGGER] Found department:`, {
        departmentId: department.id,
        departmentName: department.name,
        hasHOD: !!department.hodId,
        hodId: department.hodId
      });
      
      const result = {
        departmentExists: true,
        departmentId: department.id,
        departmentName: department.name,
        tenant: {
          id: department.tenant.id,
          name: department.tenant.name,
          status: department.tenant.status
        }
      };
      
      // Check HOD configuration
      if (!department.hodId) {
        result.hodError = 'No HOD assigned to department';
        result.suggestions = [
          'Assign an HOD to this department',
          'Check department configuration in admin panel'
        ];
      } else if (!department.hod) {
        result.hodError = 'HOD user not found (user may be deleted)';
        result.hodId = department.hodId;
        result.suggestions = [
          'Check if HOD user still exists',
          'Reassign HOD to department'
        ];
      } else {
        result.hod = {
          id: department.hod.id,
          name: `${department.hod.firstName} ${department.hod.lastName}`,
          email: department.hod.email,
          verified: department.hod.verified
        };
        
        if (!department.hod.verified) {
          result.hodWarning = 'HOD user is not verified';
        }
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ [NOTIFICATION_DEBUGGER] Department debug failed:`, error);
      return { error: error.message };
    }
  }
  
  /**
   * Debug notification system
   */
  static async debugNotificationSystem() {
    console.log(`🔍 [NOTIFICATION_DEBUGGER] Debugging notification system`);
    
    try {
      // Check recent notifications
      const recentNotifications = await prisma.notification.findMany({
        where: {
          type: 'CORRECTIVE_ACTION_COMMITTED',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          targetUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });
      
      console.log(`✅ [NOTIFICATION_DEBUGGER] Found ${recentNotifications.length} recent corrective action notifications`);
      
      return {
        systemStatus: 'operational',
        recentNotifications: recentNotifications.length,
        sampleNotifications: recentNotifications.map(n => ({
          id: n.id,
          type: n.type,
          targetUser: n.targetUser ? `${n.targetUser.firstName} ${n.targetUser.lastName}` : 'Unknown',
          createdAt: n.createdAt,
          isRead: n.isRead
        }))
      };
      
    } catch (error) {
      console.error(`❌ [NOTIFICATION_DEBUGGER] Notification system debug failed:`, error);
      return { error: error.message };
    }
  }
  
  /**
   * Debug socket.io status
   */
  static async debugSocketIO() {
    console.log(`🔍 [NOTIFICATION_DEBUGGER] Debugging socket.io status`);
    
    try {
      const socketService = require('../services/socketService');
      const io = socketService.getIO();
      
      if (!io) {
        return {
          status: 'not_initialized',
          error: 'Socket.io not initialized',
          suggestions: [
            'Check if socket service is properly configured',
            'Verify socket.io server is running',
            'Check server startup logs'
          ]
        };
      }
      
      // Get connected clients count
      const connectedClients = io.engine.clientsCount || 0;
      
      return {
        status: 'initialized',
        connectedClients,
        serverInfo: {
          adapter: io.adapter().constructor.name,
          namespace: io.name
        }
      };
      
    } catch (error) {
      console.error(`❌ [NOTIFICATION_DEBUGGER] Socket.io debug failed:`, error);
      return { 
        status: 'error',
        error: error.message 
      };
    }
  }
  
  /**
   * Generate comprehensive debug report
   */
  static async generateDebugReport(correctiveActionId) {
    console.log(`📊 [NOTIFICATION_DEBUGGER] Generating comprehensive debug report for: ${correctiveActionId}`);
    
    const debugData = await this.debugHODNotification(correctiveActionId);
    
    if (debugData.error) {
      return debugData;
    }
    
    // Generate summary
    const summary = {
      timestamp: debugData.timestamp,
      correctiveActionId: debugData.correctiveAction.id,
      overallStatus: 'unknown',
      issues: [],
      recommendations: []
    };
    
    // Check department issues
    if (debugData.departmentDebug.error) {
      summary.issues.push(`Department: ${debugData.departmentDebug.error}`);
      summary.recommendations.push(...(debugData.departmentDebug.suggestions || []));
    } else if (debugData.departmentDebug.hodError) {
      summary.issues.push(`HOD: ${debugData.departmentDebug.hodError}`);
      summary.recommendations.push(...(debugData.departmentDebug.suggestions || []));
    }
    
    // Check notification system
    if (debugData.notificationDebug.error) {
      summary.issues.push(`Notification System: ${debugData.notificationDebug.error}`);
    }
    
    // Check socket.io
    if (debugData.socketDebug.status === 'not_initialized') {
      summary.issues.push(`Socket.io: ${debugData.socketDebug.error}`);
      summary.recommendations.push(...(debugData.socketDebug.suggestions || []));
    }
    
    // Determine overall status
    if (summary.issues.length === 0) {
      summary.overallStatus = 'healthy';
    } else if (summary.issues.length <= 2) {
      summary.overallStatus = 'warning';
    } else {
      summary.overallStatus = 'critical';
    }
    
    return {
      ...debugData,
      summary
    };
  }
}

module.exports = NotificationDebugger; 