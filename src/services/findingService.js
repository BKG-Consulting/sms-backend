const findingRepository = require('../repositories/findingRepository');
const { prisma } = require('../../prisma/client');
const { AppError } = require('../../errors/app.error');
const notificationRepository = require('../repositories/notification.repository');
const notificationService = require('./notificationService');

/**
 * Find users with permission to review findings for a specific department
 * @param {string} tenantId - Tenant ID
 * @param {string} departmentName - Department name
 * @returns {Array} Array of reviewer objects with userId, roleName, and departmentName
 */
async function findReviewersForDepartment(tenantId, targetDepartmentName) {
  try {
    console.log(`🔍 Finding reviewers for department: ${targetDepartmentName} in tenant: ${tenantId}`);
    
    // Get all users with auditFinding read permission in the tenant (using notification service pattern)
    const usersWithPermission = await notificationService.getUsersWithPermission(tenantId, 'auditFinding', 'read');
    
    if (!usersWithPermission.length) {
      console.log(`❌ No users found with auditFinding:read permission in tenant: ${tenantId}`);
      return [];
    }
    
    console.log(`📊 Found ${usersWithPermission.length} users with auditFinding:read permission`);
    
    const reviewers = [];
    
    for (const user of usersWithPermission) {
      let hasDepartmentAccess = false;
      let roleName = '';
      let userDepartmentName = '';
      
      console.log(`🔍 Checking user: ${user.firstName} ${user.lastName} (${user.id})`);
      
      // Check if user has tenant-wide role with auditFinding:read permission
      // Users with tenant-wide roles can review findings, but only from their own department
      for (const userRole of user.userRoles || []) {
        const hasPermission = userRole.role?.rolePermissions?.some(rp => 
          rp.permission?.module === 'auditFinding' && 
          rp.permission?.action === 'read' && 
          rp.allowed
        );
        
        if (hasPermission) {
          // Even with tenant-wide role, check if user is assigned to the target department
          const userDepartments = user.userDepartmentRoles?.map(udr => udr.department?.name) || [];
          const userPrimaryDepartment = user.primaryDepartment?.name;
          
          // Check if user is assigned to the target department (trim whitespace for comparison)
          const trimmedTargetDepartment = targetDepartmentName.trim();
          const trimmedUserDepartments = userDepartments.map(dept => dept.trim());
          const trimmedUserPrimaryDepartment = userPrimaryDepartment?.trim();
          
          if (trimmedUserDepartments.includes(trimmedTargetDepartment) || trimmedUserPrimaryDepartment === trimmedTargetDepartment) {
            hasDepartmentAccess = true;
            roleName = userRole.role.name;
            userDepartmentName = targetDepartmentName;
            console.log(`✅ User has tenant-wide role: ${roleName} and is assigned to target department: ${targetDepartmentName}`);
            break;
          } else {
                      console.log(`❌ User has tenant-wide role: ${roleName} but is not assigned to target department: ${targetDepartmentName}`);
          console.log(`   User departments: ${userDepartments.join(', ') || 'none'}, Primary: ${userPrimaryDepartment || 'none'}`);
          console.log(`   After trimming - Target: "${trimmedTargetDepartment}", User depts: [${trimmedUserDepartments.map(d => `"${d}"`).join(', ')}], Primary: "${trimmedUserPrimaryDepartment || 'none'}"`);
          }
        }
      }
      
      // If no tenant-wide access, check if user is assigned to the specific department
      // Users with department-specific roles can only review findings from their assigned department
      // (This is now redundant since we check department assignment even for tenant-wide roles)
      if (!hasDepartmentAccess) {
        for (const userDeptRole of user.userDepartmentRoles || []) {
          console.log(`🔍 Checking department role: "${userDeptRole.department?.name}" vs target: "${targetDepartmentName}"`);
          console.log(`🔍 After trimming: "${userDeptRole.department?.name?.trim()}" vs "${targetDepartmentName.trim()}"`);
          
          if (userDeptRole.department?.name?.trim() === targetDepartmentName.trim()) {
            const hasPermission = userDeptRole.role?.rolePermissions?.some(rp => 
              rp.permission?.module === 'auditFinding' && 
              rp.permission?.action === 'read' && 
              rp.allowed
            );
            
            if (hasPermission) {
              hasDepartmentAccess = true;
              roleName = userDeptRole.role.name;
              userDepartmentName = userDeptRole.department.name;
              console.log(`✅ User has department-specific role: ${roleName} for department: ${userDepartmentName}`);
              break;
            } else {
              console.log(`❌ User is in department but doesn't have auditFinding:read permission`);
            }
          } else {
            console.log(`❌ User's department (${userDeptRole.department?.name}) doesn't match target (${targetDepartmentName})`);
          }
        }
      }
      
      if (hasDepartmentAccess) {
        reviewers.push({
          userId: user.id,
          roleName,
          departmentName: userDepartmentName
        });
        console.log(`✅ Added reviewer: ${user.firstName} ${user.lastName} (${roleName}) - ${userDepartmentName}`);
      } else {
        console.log(`❌ User ${user.firstName} ${user.lastName} doesn't have access to department ${targetDepartmentName}`);
      }
    }
    
    console.log(`🎯 Total reviewers found for ${targetDepartmentName}: ${reviewers.length}`);
    
    // Log summary of reviewers
    reviewers.forEach(reviewer => {
      console.log(`📋 Final Reviewer: ${reviewer.userId} (${reviewer.roleName}) - ${reviewer.departmentName}`);
    });
    
    return reviewers;
    
  } catch (error) {
    console.error(`❌ Error finding reviewers for department ${targetDepartmentName}:`, error);
    throw error;
  }
}

// Helper function to find users with auditProgram:create permission
async function findAuditProgramCreators(tenantId) {
  console.log(`🔍 Finding users with auditProgram:create permission in tenant: ${tenantId}`);
  
  const users = await prisma.user.findMany({
    where: { tenantId },
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

  const creators = [];

  for (const user of users) {
    let hasPermission = false;
    let roleName = '';

    // Check tenant-wide roles
    for (const userRole of user.userRoles || []) {
      const hasAuditProgramCreate = userRole.role?.rolePermissions?.some(rp =>
        rp.permission?.module === 'auditProgram' &&
        rp.permission?.action === 'create' &&
        rp.allowed
      );

      if (hasAuditProgramCreate) {
        hasPermission = true;
        roleName = userRole.role.name;
        console.log(`✅ User has tenant-wide role: ${roleName} with auditProgram:create permission`);
        break;
      }
    }

    // Check department-specific roles
    for (const userDeptRole of user.userDepartmentRoles || []) {
      const hasAuditProgramCreate = userDeptRole.role?.rolePermissions?.some(rp =>
        rp.permission?.module === 'auditProgram' &&
        rp.permission?.action === 'create' &&
        rp.allowed
      );

      if (hasAuditProgramCreate) {
        hasPermission = true;
        roleName = userDeptRole.role.name;
        console.log(`✅ User has department-specific role: ${roleName} with auditProgram:create permission`);
        break;
      }
    }

    if (hasPermission) {
      creators.push({
        userId: user.id,
        roleName
      });
    }
  }

  console.log(`📋 Found ${creators.length} users with auditProgram:create permission`);
  return creators;
}

async function createFinding({ auditId, createdById, department, title, description, criteria, attachments }) {
  // Validate audit exists
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, include: { teamMembers: true } });
  if (!audit) throw new AppError('Audit not found', 404);
  // Validate creator is a team member
  if (!audit.teamMembers.some(tm => tm.userId === createdById)) {
    throw new AppError('You are not a team member of this audit', 403);
  }
  // Create finding
  return findingRepository.createFinding({
    auditId,
    createdById,
    department,
    title,
    description,
    criteria,
    attachments: attachments || [],
  });
}

async function getFindingsByAudit(auditId, tenantId) {
  return await findingRepository.getFindingsByAudit(auditId, tenantId);
}

async function getFindingsByAuditWithUserScope(auditId, tenantId, userId) {
  console.log('🔒 Getting findings with user scope:', { auditId, tenantId, userId });
  
  // Get user's checklist scope
  const checklistService = require('./checklistService');
  const checklists = await checklistService.getChecklistsByAudit(auditId);
  
  // Get user's assigned departments
  const userDepartments = new Set();
  
  for (const checklist of checklists) {
    const isAssigned = checklist.assignees?.some(assignee => assignee.userId === userId) ||
                      checklist.createdBy?.id === userId;
    
    if (isAssigned && checklist.department) {
      const departments = checklist.department.split(',').map(d => d.trim());
      departments.forEach(dept => userDepartments.add(dept));
    }
  }
  
  console.log('🔒 User departments:', Array.from(userDepartments));
  
  // Get all findings for the audit
  const allFindings = await findingRepository.getFindingsByAudit(auditId, tenantId);
  
  // Filter findings by user's assigned departments
  const filteredFindings = allFindings.filter(finding => {
    const hasAccess = userDepartments.has(finding.department);
    if (!hasAccess) {
      console.log('🔒 Filtering out finding:', finding.id, 'department:', finding.department, 'not in user departments');
    }
    return hasAccess;
  });
  
  console.log('🔒 Filtered findings count:', filteredFindings.length, 'from total:', allFindings.length);
  
  return filteredFindings;
}

function getFindingById(id) {
  return findingRepository.getFindingById(id);
}

async function updateFinding(id, data) {
  // Only allow certain fields to be updated
  const allowed = ['title', 'description', 'criteria', 'attachments', 'department', 'category', 'status', 'hodFeedback'];
  const updateData = Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
  const { nonConformityType, nonConformitySeverity } = data;

  // Fetch the current finding
  const finding = await prisma.auditFinding.findUnique({ where: { id }, include: { nonConformities: true, compliance: true, improvements: true } });
  if (!finding) throw new AppError('Finding not found', 404);

  // Detect category change
  const newCategory = updateData.category;
  const prevCategory = finding.category;

  // Use a transaction for consistency
  return await prisma.$transaction(async (tx) => {
    // Update the finding
    const updatedFinding = await tx.auditFinding.update({
      where: { id },
      data: updateData,
      include: { createdBy: true, nonConformities: true, compliance: true, improvements: true }
    });

    // Only act if category is being set/changed
    if (newCategory && newCategory !== prevCategory) {
      console.log(`🔄 [FINDING_UPDATE] Category changed from ${prevCategory} to ${newCategory} for finding: ${id}`);
      
      if (newCategory === 'NON_CONFORMITY') {
        // Create or update NonConformity with classification if provided
        let nonConformity = finding.nonConformities && finding.nonConformities.length > 0
          ? finding.nonConformities[0]
          : null;
        if (!nonConformity) {
          try {
            // Auto-classify non-conformity based on finding content
            const { autoType, autoSeverity } = autoClassifyNonConformity(finding);
            
            nonConformity = await tx.nonConformity.create({
              data: {
                findingId: id,
                createdById: finding.createdById,
                title: finding.title,
                description: finding.description,
                type: nonConformityType || autoType,
                severity: nonConformitySeverity || autoSeverity,
                status: 'OPEN',
              }
            });
            console.log(`✅ [FINDING_UPDATE] Created NonConformity: ${nonConformity.id} with auto-classification: ${autoType}/${autoSeverity}`);
          } catch (error) {
            console.error(`❌ [FINDING_UPDATE] Failed to create NonConformity:`, error);
            throw error;
          }
        } else {
          // Update classification if provided
          if (nonConformityType || nonConformitySeverity) {
            await tx.nonConformity.update({
              where: { id: nonConformity.id },
              data: {
                ...(nonConformityType && { type: nonConformityType }),
                ...(nonConformitySeverity && { severity: nonConformitySeverity }),
              }
            });
            console.log(`✅ [FINDING_UPDATE] Updated NonConformity classification: ${nonConformity.id}`);
          } else {
            console.log(`ℹ️ [FINDING_UPDATE] NonConformity already exists for finding: ${id}`);
          }
        }
      } else if (newCategory === 'COMPLIANCE') {
        // ...existing code for compliance...
        if (!finding.compliance) {
          try {
            const compliance = await tx.complianceRecord.create({
              data: {
                findingId: id,
                createdById: finding.createdById,
                status: 'COMPLIANT', // default
                evidence: '',
                notes: '',
              }
            });
            console.log(`✅ [FINDING_UPDATE] Created ComplianceRecord: ${compliance.id}`);
          } catch (error) {
            console.error(`❌ [FINDING_UPDATE] Failed to create ComplianceRecord:`, error);
            throw error;
          }
        } else {
          console.log(`ℹ️ [FINDING_UPDATE] ComplianceRecord already exists for finding: ${id}`);
        }
      } else if (newCategory === 'IMPROVEMENT') {
        // ...existing code for improvement...
        if (!finding.improvements) {
          try {
            const existingImprovement = await tx.improvementOpportunity.findUnique({
              where: { findingId: id }
            });
            if (!existingImprovement) {
              const improvement = await tx.improvementOpportunity.create({
                data: {
                  findingId: id,
                  createdById: finding.createdById,
                  opportunity: finding.title || 'Improvement Opportunity',
                  actionPlan: '',
                  status: 'OPEN',
                }
              });
              console.log(`✅ [FINDING_UPDATE] Created ImprovementOpportunity: ${improvement.id}`);
            } else {
              console.log(`ℹ️ [FINDING_UPDATE] ImprovementOpportunity already exists: ${existingImprovement.id}`);
              if (!existingImprovement.opportunity || !existingImprovement.status) {
                await tx.improvementOpportunity.update({
                  where: { id: existingImprovement.id },
                  data: {
                    opportunity: finding.title || 'Improvement Opportunity',
                    status: 'OPEN',
                  }
                });
                console.log(`✅ [FINDING_UPDATE] Updated existing ImprovementOpportunity: ${existingImprovement.id}`);
              }
            }
          } catch (error) {
            console.error(`❌ [FINDING_UPDATE] Failed to create/update ImprovementOpportunity:`, error);
            throw error;
          }
        } else {
          console.log(`ℹ️ [FINDING_UPDATE] ImprovementOpportunity already exists for finding: ${id}`);
        }
      }
    }
    // Return the updated finding (with relations)
    return tx.auditFinding.findUnique({
      where: { id },
      include: { createdBy: true, nonConformities: true, compliance: true, improvements: true }
    });
  });
}

function deleteFinding(id) {
  return findingRepository.deleteFinding(id);
}
async function commitFindings({ auditId, department, userId }) {
  // 1. Find all PENDING findings for the audit (and department, if provided)
  const where = {
    auditId,
    status: 'PENDING',
    ...(department ? { department } : {}),
  };

  const findings = await prisma.auditFinding.findMany({ where });
  if (!findings.length) throw new AppError('No pending findings to commit', 400);

  // 2. Update all findings to status 'UNDER_REVIEW'
  await prisma.auditFinding.updateMany({
    where,
    data: {
      status: 'UNDER_REVIEW',
    }
  });

  // 3. Get audit and tenant information
  const audit = await prisma.audit.findUnique({ 
    where: { id: auditId }, 
    include: { auditProgram: true } 
  });
  const tenantId = audit?.auditProgram?.tenantId;
  if (!tenantId) throw new AppError('Invalid tenant information for audit', 400);

  // 4. Find users with permission to review findings for the relevant department(s)
  let reviewersToNotify = [];

  if (department) {
    // Single department mode
    const reviewers = await findReviewersForDepartment(tenantId, department);
    reviewersToNotify.push(...reviewers);
  } else {
    // Multi-department mode — get departments from findings
    const departmentsInFindings = [...new Set(findings.map(f => f.department))];
    
    for (const dept of departmentsInFindings) {
      const reviewers = await findReviewersForDepartment(tenantId, dept);
      reviewersToNotify.push(...reviewers);
    }
  }

  // Remove duplicates
  reviewersToNotify = [...new Set(reviewersToNotify.map(r => r.userId))].map(userId => 
    reviewersToNotify.find(r => r.userId === userId)
  );
  
  if (!reviewersToNotify.length) {
    throw new AppError('No users with auditFinding:read permission found for department(s)', 404);
  }

  // 5. Send notifications to users with findings review permission
  for (const reviewer of reviewersToNotify) {
    const programId = audit?.auditProgram?.id;

    const reviewLink = `/hod/findings-review?auditId=${auditId}${department ? `&department=${encodeURIComponent(department)}` : ''}`;

    const notification = await notificationRepository.createNotification({
      type: 'FINDINGS_COMMITTED',
      title: department
        ? `Audit Findings for ${department} Submitted for Review`
        : 'Audit Findings Submitted for Review',
      message: department
        ? `Audit findings for department "${department}" in audit #${audit?.auditNo} (${audit?.auditProgram?.title}) have been submitted for your review.`
        : `Audit findings for audit #${audit?.auditNo} (${audit?.auditProgram?.title}) have been submitted for your review.`,
      tenantId,
      targetUserId: reviewer.userId,
      link: reviewLink,
      metadata: { 
        auditId, 
        department, 
        committedBy: userId,
        reviewerRole: reviewer.roleName,
        reviewerDepartment: reviewer.departmentName
      },
    });

    // Emit real-time notification
    try {
      const socketService = require('./socketService');
      const io = socketService.getIO();
      io.to(`user:${reviewer.userId}`).emit('notificationCreated', { ...notification, userId: reviewer.userId });
    } catch (err) {
      console.error('Failed to emit real-time notification to reviewer:', err);
    }
  }
}


async function hodReviewFinding({ findingId, userId, status, hodFeedback }) {
  // 1. Fetch the finding and its department
  const finding = await prisma.auditFinding.findUnique({ 
    where: { id: findingId },
    include: {
      audit: {
        include: {
          auditProgram: {
            select: { tenantId: true }
          }
        }
      }
    }
  });
  if (!finding) throw new AppError('Finding not found', 404);
  
  // 2. No permission check needed - users are routed here from notifications that already validated permissions
  // The notification system ensures only users with proper permissions receive the notification
  // 3. Only allow ACCEPTED or REFUSED
  if (!['ACCEPTED', 'REFUSED'].includes(status)) throw new AppError('Invalid status', 400);
  
  // 4. Update finding with reviewed status and timestamp
  const updatedFinding = await findingRepository.updateFinding(findingId, { 
    status, 
    hodFeedback,
    reviewed: true,
    reviewedAt: new Date()
  });

  // 5. Notify the Team Leader who created this finding
  const audit = await prisma.audit.findUnique({
    where: { id: finding.auditId },
    include: { auditProgram: true }
  });
  
  if (audit && finding.createdById) {
    const programId = audit.auditProgram.id;
    const findingsManagerLink = `/audit-management/audits/findings?programId=${programId}&auditId=${audit.id}`;
    
    // Create notification for Team Leader
    await notificationRepository.createNotification({
        type: 'FINDING_REVIEWED',
        title: `Finding ${status.toLowerCase()} by reviewer`,
        message: `Your finding "${finding.title}" has been ${status.toLowerCase()} by a reviewer for ${finding.department}.`,
        tenantId: audit.auditProgram.tenantId,
        targetUserId: finding.createdById,
        link: findingsManagerLink,
        metadata: { 
          auditId: finding.auditId, 
          findingId: finding.id,
          department: finding.department,
          reviewDecision: status,
          programId: programId 
        }
    });

    // Emit real-time notification to Team Leader
    try {
      const socketService = require('./socketService');
      const io = socketService.getIO();
      io.to(`user:${finding.createdById}`).emit('notificationCreated', {
        type: 'FINDING_REVIEWED',
        title: `Finding ${status.toLowerCase()} by reviewer`,
        message: `Your finding "${finding.title}" has been ${status.toLowerCase()} by a reviewer for ${finding.department}.`,
        tenantId: audit.auditProgram.tenantId,
        targetUserId: finding.createdById,
        link: findingsManagerLink,
        metadata: { 
          auditId: finding.auditId, 
          findingId: finding.id,
          department: finding.department,
          reviewDecision: status,
          programId: programId 
        },
        userId: finding.createdById
      });
    } catch (err) {
      console.error('Failed to emit real-time notification to Team Leader:', err);
    }
  }

  return updatedFinding;
}

async function finishFindingsReview({ auditId, department, userId }) {
  // 1. Find all findings for the audit and department
  const where = {
    auditId,
    ...(department ? { department } : {}),
  };
  const findings = await prisma.auditFinding.findMany({ where });
  if (!findings.length) throw new AppError('No findings to finish review', 400);

  // 2. Mark all as reviewed (add reviewed: true or reviewedAt)
  await prisma.auditFinding.updateMany({
    where,
    data: { reviewed: true, reviewedAt: new Date() },
  });

  // 3. Find all unique createdById (team leader or finding creators)
  const creatorIds = [...new Set(findings.map(f => f.createdById))];
  if (!creatorIds.length) throw new AppError('No finding creators found', 404);

  // 4. Send notification to each creator
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, include: { auditProgram: true } });
  for (const creatorId of creatorIds) {
    const programId = audit?.auditProgram?.id;
    const findingsManagerLink = `/audit-management/audits/findings?programId=${programId}&auditId=${auditId}`;
    await notificationRepository.createNotification({
      type: 'FINDINGS_REVIEW_FINISHED',
      title: department
        ? `Findings Review Finished for ${department}`
        : 'Findings Review Finished',
      message: department
        ? `The HOD has finished reviewing findings for department "${department}" in audit #${audit?.auditNo} (${audit?.auditProgram?.title}).`
        : `The HOD has finished reviewing findings in audit #${audit?.auditNo} (${audit?.auditProgram?.title}).`,
      tenantId: audit?.auditProgram?.tenantId,
      targetUserId: creatorId,
      link: findingsManagerLink,
      metadata: { auditId, department, finishedBy: userId },
    });
  }
}

// Finish categorization: mark all findings as categorizationFinished, notify users with permission and audit program creators
async function finishCategorization({ auditId, department, userId }) {
  // 1. Find all findings for the audit and department
  const where = {
    auditId,
    ...(department ? { department } : {}),
  };
  const findings = await prisma.auditFinding.findMany({ where });
  if (!findings.length) throw new AppError('No findings to finish categorization', 400);

  // 2. Mark all as categorizationFinished (add field if needed)
  await prisma.auditFinding.updateMany({
    where,
    data: { categorizationFinished: true, categorizationFinishedAt: new Date() },
  });

  // 3. Get audit and tenant information
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: { auditProgram: true }
  });
  if (!audit) throw new AppError('Audit not found', 404);
  
  const tenantId = audit?.auditProgram?.tenantId;
  if (!tenantId) throw new AppError('Invalid tenant information for audit', 400);

  // 4. Generate detailed categorization summary
  const categorizationSummary = generateCategorizationSummary(findings, department);

  // 5. Find users with permission to review findings for the relevant department(s)
  let reviewersToNotify = [];

  if (department) {
    // Single department mode
    const reviewers = await findReviewersForDepartment(tenantId, department);
    reviewersToNotify.push(...reviewers);
  } else {
    // Multi-department mode — get departments from findings
    const departmentsInFindings = [...new Set(findings.map(f => f.department))];
    
    for (const dept of departmentsInFindings) {
      const reviewers = await findReviewersForDepartment(tenantId, dept);
      reviewersToNotify.push(...reviewers);
    }
  }

  // Remove duplicates
  reviewersToNotify = [...new Set(reviewersToNotify.map(r => r.userId))].map(userId => 
    reviewersToNotify.find(r => r.userId === userId)
  );

  // 6. Find users with auditProgram:create permission
  const auditProgramCreators = await findAuditProgramCreators(tenantId);

  // 7. Send notifications to users with findings review permission
  for (const reviewer of reviewersToNotify) {
    const programId = audit?.auditProgram?.id;
    const reviewLink = `/hod/findings-review?auditId=${auditId}${department ? `&department=${encodeURIComponent(department)}` : ''}`;

    const notification = await notificationRepository.createNotification({
      type: 'FINDINGS_CATEGORIZATION_FINISHED',
      title: department
        ? `Findings Categorization Completed for ${department}`
        : 'Findings Categorization Completed',
      message: department
        ? `Findings for department "${department}" in audit #${audit?.auditNo} (${audit?.auditProgram?.title}) have been categorized and completed. ${categorizationSummary}`
        : `Findings for audit #${audit?.auditNo} (${audit?.auditProgram?.title}) have been categorized and completed. ${categorizationSummary}`,
      tenantId,
      targetUserId: reviewer.userId,
      link: reviewLink,
      metadata: { 
        auditId, 
        department, 
        categorizedBy: userId,
        reviewerRole: reviewer.roleName,
        reviewerDepartment: reviewer.departmentName,
        categorizationSummary
      },
    });

    // Emit real-time notification
    try {
      const socketService = require('./socketService');
      const io = socketService.getIO();
      io.to(`user:${reviewer.userId}`).emit('notificationCreated', { ...notification, userId: reviewer.userId });
      console.log(`[DEBUG] Real-time notification emitted to user:${reviewer.userId}`);
    } catch (err) {
      console.error('Failed to emit real-time notification to reviewer:', err);
    }
  }

  // 8. Send notifications to audit program creators
  for (const creator of auditProgramCreators) {
    const programId = audit?.auditProgram?.id;
    const auditProgramLink = `/audit-management/audit-programs/${programId}/audits/${auditId}`;

    const notification = await notificationRepository.createNotification({
      type: 'FINDINGS_CATEGORIZATION_FINISHED',
      title: department
        ? `Findings Categorization Completed for ${department}`
        : 'Findings Categorization Completed',
      message: department
        ? `Findings for department "${department}" in audit #${audit?.auditNo} (${audit?.auditProgram?.title}) have been categorized and completed. ${categorizationSummary}`
        : `Findings for audit #${audit?.auditNo} (${audit?.auditProgram?.title}) have been categorized and completed. ${categorizationSummary}`,
      tenantId,
      targetUserId: creator.userId,
      link: auditProgramLink,
      metadata: { 
        auditId, 
        department, 
        categorizedBy: userId,
        creatorRole: creator.roleName,
        categorizationSummary
      },
    });

    // Emit real-time notification
    try {
      const socketService = require('./socketService');
      const io = socketService.getIO();
      io.to(`user:${creator.userId}`).emit('notificationCreated', { ...notification, userId: creator.userId });
      console.log(`[DEBUG] Real-time notification emitted to audit program creator:${creator.userId}`);
    } catch (err) {
      console.error('Failed to emit real-time notification to audit program creator:', err);
    }
  }
}

// Helper function to generate detailed categorization summary
function generateCategorizationSummary(findings, department) {
  const categoryCounts = {};
  const totalFindings = findings.length;
  
  // Count findings by category
  findings.forEach(finding => {
    const category = finding.category || 'UNCATEGORIZED';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  // Build summary text
  const categoryDetails = Object.entries(categoryCounts)
    .map(([category, count]) => `${count} ${category.toLowerCase()}`)
    .join(', ');

  const departmentText = department ? ` for ${department}` : '';
  
  return `Summary${departmentText}: ${totalFindings} total findings categorized as ${categoryDetails}.`;
}

async function getGlobalFindings(filters) {
  const where = {};
  
  // CRITICAL: Always filter by tenant for data integrity
  if (filters.tenantId) {
    where.audit = {
      ...where.audit,
      auditProgram: {
        tenantId: filters.tenantId
      }
    };
  } else {
    throw new Error('Tenant ID is required for data security');
  }
  
  if (filters.auditId) where.auditId = filters.auditId;
  if (filters.department) where.department = filters.department;
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } }
    ];
  }
  // Nested filter for auditProgramId
  if (filters.auditProgramId) {
    where.audit = { 
      ...where.audit,
      auditProgramId: filters.auditProgramId 
    };
  }
  // Pagination
  const page = parseInt(filters.page, 10) || 1;
  const pageSize = parseInt(filters.pageSize, 10) || 10;
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  return await require('../repositories/findingRepository').getGlobalFindingsPaginated(where, skip, take);
}

async function getNonConformities(filters) {
  const where = {};
  
  // CRITICAL: Always filter by tenant for data integrity
  if (filters.tenantId) {
    where.finding = {
      ...where.finding,
      audit: {
        ...where.finding?.audit,
        auditProgram: {
          tenantId: filters.tenantId
        }
      }
    };
  } else {
    throw new Error('Tenant ID is required for data security');
  }
  
  // Filter by status
  if (filters.status) where.status = filters.status;
  
  // Filter by type
  if (filters.type) where.type = filters.type;
  
  // Filter by severity
  if (filters.severity) where.severity = filters.severity;
  
  // Filter by date range
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }
  
  // Filter by search term
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { finding: { title: { contains: filters.search, mode: 'insensitive' } } },
      { finding: { description: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }
  
  // Filter by department
  if (filters.department) {
    where.finding = { 
      ...where.finding,
      department: filters.department 
    };
  }
  
  // Filter by audit program
  if (filters.auditProgramId) {
    where.finding = { 
      ...where.finding,
      audit: { 
        ...where.finding?.audit,
        auditProgramId: filters.auditProgramId 
      } 
    };
  }
  
  // Filter by audit ID
  if (filters.auditId) {
    where.finding = { 
      ...where.finding,
      auditId: filters.auditId 
    };
  }
  
  // Pagination
  const page = parseInt(filters.page, 10) || 1;
  const pageSize = parseInt(filters.pageSize, 10) || 10;
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  
  return await require('../repositories/findingRepository').getNonConformitiesPaginated(where, skip, take);
}

/**
 * Auto-classify non-conformity based on finding content
 * Uses simple keyword analysis to determine type and severity
 * @param {Object} finding - The finding object
 * @returns {Object} { autoType, autoSeverity }
 */
function autoClassifyNonConformity(finding) {
  const title = (finding.title || '').toLowerCase();
  const description = (finding.description || '').toLowerCase();
  const fullText = `${title} ${description}`;
  
  // Keywords for MAJOR non-conformities
  const majorKeywords = [
    'critical', 'severe', 'major', 'serious', 'urgent', 'immediate',
    'safety', 'security', 'compliance', 'regulatory', 'legal',
    'breach', 'violation', 'non-compliance', 'failure', 'breakdown',
    'emergency', 'hazard', 'risk', 'danger', 'threat'
  ];
  
  // Keywords for MINOR non-conformities
  const minorKeywords = [
    'minor', 'small', 'slight', 'minor', 'trivial', 'insignificant',
    'cosmetic', 'appearance', 'formatting', 'documentation', 'paperwork',
    'procedural', 'process', 'routine', 'standard', 'normal'
  ];
  
  // Keywords for OBSERVATION
  const observationKeywords = [
    'observation', 'note', 'comment', 'suggestion', 'recommendation',
    'improvement', 'enhancement', 'optimization', 'better', 'best practice',
    'opportunity', 'potential', 'consider', 'review', 'evaluate'
  ];
  
  // Keywords for HIGH/CRITICAL severity
  const highSeverityKeywords = [
    'critical', 'urgent', 'immediate', 'emergency', 'hazard', 'danger',
    'threat', 'breach', 'violation', 'failure', 'breakdown', 'safety',
    'security', 'compliance', 'regulatory', 'legal'
  ];
  
  // Keywords for MEDIUM severity
  const mediumSeverityKeywords = [
    'moderate', 'medium', 'standard', 'normal', 'routine', 'process',
    'procedural', 'documentation', 'paperwork', 'formatting'
  ];
  
  // Keywords for LOW severity
  const lowSeverityKeywords = [
    'minor', 'small', 'slight', 'trivial', 'insignificant', 'cosmetic',
    'appearance', 'suggestion', 'recommendation', 'improvement'
  ];
  
  // Determine type
  let autoType = 'MAJOR'; // Default
  
  if (observationKeywords.some(keyword => fullText.includes(keyword))) {
    autoType = 'OBSERVATION';
  } else if (minorKeywords.some(keyword => fullText.includes(keyword))) {
    autoType = 'MINOR';
  } else if (majorKeywords.some(keyword => fullText.includes(keyword))) {
    autoType = 'MAJOR';
  }
  
  // Determine severity
  let autoSeverity = 'MEDIUM'; // Default
  
  if (highSeverityKeywords.some(keyword => fullText.includes(keyword))) {
    autoSeverity = 'HIGH';
  } else if (lowSeverityKeywords.some(keyword => fullText.includes(keyword))) {
    autoSeverity = 'LOW';
  } else if (mediumSeverityKeywords.some(keyword => fullText.includes(keyword))) {
    autoSeverity = 'MEDIUM';
  }
  
  // Special case: OBSERVATION type should typically be LOW severity
  if (autoType === 'OBSERVATION' && autoSeverity === 'HIGH') {
    autoSeverity = 'MEDIUM';
  }
  
  console.log(`🤖 [AUTO_CLASSIFICATION] Finding: "${finding.title}"`);
  console.log(`🤖 [AUTO_CLASSIFICATION] Detected: ${autoType}/${autoSeverity}`);
  
  return { autoType, autoSeverity };
}

module.exports = {
  createFinding,
  getFindingsByAudit,
  getFindingsByAuditWithUserScope,
  getFindingById,
  updateFinding,
  deleteFinding,
  commitFindings,
  hodReviewFinding,
  finishFindingsReview,
  finishCategorization,
  getGlobalFindings,
  getNonConformities,
  findReviewersForDepartment,
  findAuditProgramCreators,
};
