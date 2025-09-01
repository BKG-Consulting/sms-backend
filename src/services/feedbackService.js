const feedbackRepository = require('../repositories/feedbackRepository');
const { AppError } = require('../../errors/app.error');
const notificationRepository = require('../repositories/notification.repository');
const notificationService = require('./notificationService');

/**
 * Find users with permission to respond to feedback for a specific department
 * @param {string} tenantId - Tenant ID
 * @param {string} departmentId - Department ID
 * @returns {Array} Array of responder objects with userId, roleName, and departmentName
 */
async function findFeedbackRespondersForDepartment(tenantId, departmentId) {
  try {
    console.log(`🔍 Finding feedback responders for department: ${departmentId} in tenant: ${tenantId}`);
    
    // Get all users with feedback:respond permission in the tenant
    const usersWithPermission = await notificationService.getUsersWithPermission(tenantId, 'feedback', 'respond');
    
    if (!usersWithPermission.length) {
      console.log(`❌ No users found with feedback:respond permission in tenant: ${tenantId}`);
      return [];
    }
    
    console.log(`📊 Found ${usersWithPermission.length} users with feedback:respond permission`);
    
    const responders = [];
    
    for (const user of usersWithPermission) {
      let hasDepartmentAccess = false;
      let roleName = '';
      let userDepartmentName = '';
      
      console.log(`🔍 Checking user: ${user.firstName} ${user.lastName} (${user.id})`);
      
      // Check if user has tenant-wide role with feedback:respond permission
      for (const userRole of user.userRoles || []) {
        const hasPermission = userRole.role?.rolePermissions?.some(rp => 
          rp.permission?.module === 'feedback' && 
          rp.permission?.action === 'respond' && 
          rp.allowed
        );
        
        if (hasPermission) {
          // Even with tenant-wide role, check if user is assigned to the target department
          const userDepartments = user.userDepartmentRoles?.map(udr => udr.department?.id) || [];
          const userPrimaryDepartment = user.primaryDepartment?.id;
          
          // Check if user is assigned to the target department
          if (userDepartments.includes(departmentId) || userPrimaryDepartment === departmentId) {
            hasDepartmentAccess = true;
            roleName = userRole.role.name;
            userDepartmentName = user.userDepartmentRoles?.find(udr => udr.departmentId === departmentId)?.department?.name || 
                                user.primaryDepartment?.name;
            console.log(`✅ User has tenant-wide role: ${roleName} and is assigned to target department: ${userDepartmentName}`);
            break;
          } else {
            console.log(`❌ User has tenant-wide role: ${roleName} but is not assigned to target department: ${departmentId}`);
          }
        }
      }
      
      // If no tenant-wide access, check if user is assigned to the specific department
      if (!hasDepartmentAccess) {
        for (const userDeptRole of user.userDepartmentRoles || []) {
          if (userDeptRole.departmentId === departmentId) {
            const hasPermission = userDeptRole.role?.rolePermissions?.some(rp => 
              rp.permission?.module === 'feedback' && 
              rp.permission?.action === 'respond' && 
              rp.allowed
            );
            
            if (hasPermission) {
              hasDepartmentAccess = true;
              roleName = userDeptRole.role.name;
              userDepartmentName = userDeptRole.department.name;
              console.log(`✅ User has department-specific role: ${roleName} for department: ${userDepartmentName}`);
              break;
            } else {
              console.log(`❌ User is in department but doesn't have feedback:respond permission`);
            }
          }
        }
      }
      
      if (hasDepartmentAccess) {
        responders.push({
          userId: user.id,
          roleName,
          departmentName: userDepartmentName
        });
        console.log(`✅ Added responder: ${user.firstName} ${user.lastName} (${roleName}) - ${userDepartmentName}`);
      } else {
        console.log(`❌ User ${user.firstName} ${user.lastName} doesn't have access to department ${departmentId}`);
      }
    }
    
    console.log(`🎯 Total responders found for department ${departmentId}: ${responders.length}`);
    
    // Log summary of responders
    responders.forEach(responder => {
      console.log(`📋 Final Responder: ${responder.userId} (${responder.roleName}) - ${responder.departmentName}`);
    });
    
    return responders;
    
  } catch (error) {
    console.error(`❌ Error finding feedback responders for department ${departmentId}:`, error);
    throw error;
  }
}

const feedbackService = {
  createFeedback: async (data) => {
    // Create the feedback first
    const feedback = await feedbackRepository.createFeedback(data);
    
    // If feedback has a department, send notifications to users with feedback:respond permission
    if (data.departmentId && data.tenantId) {
      try {
        console.log(`📢 Sending feedback notification for department: ${data.departmentId}`);
        
        // Find users with feedback:respond permission for the department
        const responders = await findFeedbackRespondersForDepartment(data.tenantId, data.departmentId);
        
        if (responders.length > 0) {
          // Get department name for notification
          const department = await require('../../prisma/client').prisma.department.findUnique({
            where: { id: data.departmentId },
            select: { name: true }
          });
          
          const departmentName = department?.name || 'Unknown Department';
          
          // Send notifications to each responder
          for (const responder of responders) {
            const feedbackLink = `/feedback/${feedback.id}`;
            
            const notification = await notificationRepository.createNotification({
              type: 'FEEDBACK_SUBMITTED',
              title: `New Feedback for ${departmentName}`,
              message: `New ${data.origin.toLowerCase()} feedback has been submitted for ${departmentName}. Category: ${data.category}, Subject: ${data.subject}`,
              tenantId: data.tenantId,
              targetUserId: responder.userId,
              link: feedbackLink,
              metadata: { 
                feedbackId: feedback.id,
                departmentId: data.departmentId,
                departmentName,
                category: data.category,
                origin: data.origin,
                submittedBy: data.createdById,
                responderRole: responder.roleName,
                responderDepartment: responder.departmentName
              },
            });

            // Emit real-time notification
            try {
              const socketService = require('./socketService');
              const io = socketService.getIO();
              io.to(`user:${responder.userId}`).emit('notificationCreated', { ...notification, userId: responder.userId });
              console.log(`[DEBUG] Real-time feedback notification emitted to user:${responder.userId}`);
            } catch (err) {
              console.error('Failed to emit real-time feedback notification to responder:', err);
            }
          }
          
          console.log(`✅ Sent feedback notifications to ${responders.length} responders`);
        } else {
          console.log(`⚠️ No users found with feedback:respond permission for department: ${data.departmentId}`);
        }
      } catch (error) {
        console.error('❌ Error sending feedback notifications:', error);
        // Don't throw error - feedback creation should still succeed even if notifications fail
      }
    }
    
    return feedback;
  },
  
  getFeedbacks: async (tenantId, filters = {}) => {
    return feedbackRepository.getFeedbacks({ tenantId, ...filters });
  },
  
  getFeedbackById: async (id, tenantId) => {
    const feedback = await feedbackRepository.getFeedbackById(id);
    if (!feedback || feedback.tenantId !== tenantId) throw new AppError('Feedback not found', 404);
    return feedback;
  }
};

module.exports = feedbackService; 