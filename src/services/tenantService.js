const {prisma} = require('../../prisma/client')
const tenantRepository  = require('../repositories/tenantRepository');
const brandingService = require('./brandingService');
const roleService = require('./roleService');
const departmentService = require('./department.service');
const { logger } = require('../utils/logger');
const bcrypt = require('bcryptjs');
const auditLogger = require('../utils/auditLogger'); // Assume audit logger utility exists
const { logEvent } = require('../utils/auditLogger');

// Add helper to get or create HOD role for tenant
async function getHodRoleForTenant(tenantId, tx) {
  let hodRole = await tx.role.findFirst({ where: { name: 'HOD', tenantId } });
  if (!hodRole) {
    hodRole = await tx.role.create({
      data: {
        name: 'HOD',
        description: 'Head of Department',
        tenant: { connect: { id: tenantId } }
      }
    });
  }
  return hodRole;
}
// Add helper to get or create STAFF role for tenant
async function getStaffRoleForTenant(tenantId, tx) {
  let staffRole = await tx.role.findFirst({ where: { name: 'STAFF', tenantId } });
  if (!staffRole) {
    staffRole = await tx.role.create({
      data: {
        name: 'STAFF',
        description: 'Staff member',
        tenant: { connect: { id: tenantId } }
      }
    });
  }
  return staffRole;
}

// Add helper to get or create HOD and HOD AUDITOR roles for tenant
async function getHodRolesForTenant(tenantId, tx) {
  // Fetch both HOD and HOD AUDITOR roles
  let hodRoles = await tx.role.findMany({
    where: {
      tenantId,
      name: { in: ['HOD', 'HOD AUDITOR'] }
    }
  });
  // Create missing roles if needed
  const roleNames = hodRoles.map(r => r.name);
  if (!roleNames.includes('HOD')) {
    const hod = await tx.role.create({
      data: {
        name: 'HOD',
        description: 'Head of Department',
        tenant: { connect: { id: tenantId } }
      }
    });
    hodRoles.push(hod);
  }
  if (!roleNames.includes('HOD AUDITOR')) {
    const hodAuditor = await tx.role.create({
      data: {
        name: 'HOD AUDITOR',
        description: 'Head of Department Auditor',
        tenant: { connect: { id: tenantId } }
      }
    });
    hodRoles.push(hodAuditor);
  }
  return hodRoles;
}

const tenantService = {
  getTenantInfoByDomain: async (domain) => {
    // Idempotency: check for existing tenant
    const tenant = await tenantRepository.findTenantByDomainWithBranding(domain);
    console.log('Tenant data from repository:', tenant);
    if (!tenant) return null;
    
    // Return the tenant with branding in the expected structure
    return tenant;
  },
  createTenantWithAdmin: async (payload) => {
    // Idempotency: check for existing tenant by domain/email
    const existing = await tenantRepository.findTenantByDomainOrEmail(payload.tenant.domain, payload.tenant.email);
    if (existing) throw { code: 'P2002', meta: { target: ['domain/email'] } };
    
    // Use enhanced onboarding service that creates essential roles
    return require('./enhancedTenantOnboardingService').onboardTenantWithAdmin(payload);
  },
  parseTenantUpdate: (body) => {
    // Centralize update schema validation
    const updateSchema = require('zod').object({
      name: require('zod').string().min(1).optional(),
      domain: require('zod').string().min(1).optional(),
      email: require('zod').string().email().optional(),
      type: require('zod').string().min(1).optional(),
      logoUrl: require('zod').string().optional(),
      phone: require('zod').string().optional(),
      accreditationNumber: require('zod').string().optional(),
      establishedYear: require('zod').union([require('zod').string(), require('zod').number()]).optional(),
      timezone: require('zod').string().optional(),
      currency: require('zod').string().optional(),
      address: require('zod').string().optional(),
      city: require('zod').string().optional(),
      county: require('zod').string().optional(),
      country: require('zod').string().optional(),
    });
    return updateSchema.parse(body);
  },
  suspendTenant: async (tenantId, updatedBy) => {
    const updatedTenant = await tenantRepository.updateTenant(tenantId, { status: 'INACTIVE' });
    if (logEvent) logEvent('tenant_suspended', { tenantId, updatedBy });
    return updatedTenant;
  },
  getTenantByDomain: async (domain) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { domain },
        select: {
          id: true,
          name: true,
          domain: true,
          logoUrl: true,
          type: true,
          status: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          county: true,
          country: true,
          website: true,
          postalCode: true,
          registrationNumber: true,
          legalName: true,
          contactPerson: true,
          contactEmail: true,
          contactPhone: true,
          subscriptionPlan: true,
          maxUsers: true,
          maxStorageGB: true,
          branding: {
            select: {
              primaryColor: true,
              secondaryColor: true,
              tagline: true,
              description: true,
              metaTitle: true,
              metaDescription: true,
              metaKeywords: true
            }
          }
        }
      });
      
      return tenant;
    } catch (error) {
      logger.error('Error fetching tenant by domain:', { domain, error: error.message });
      throw error;
    }
  },

  getAllTenants: async () => {
    try {
      return await prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error('Error fetching all tenants:', error);
      throw error;
    }
  },

  getTenantById: async (id) => {
    try {
      return await prisma.tenant.findUnique({
        where: { id }
      });
    } catch (error) {
      logger.error('Error fetching tenant by ID:', { id, error: error.message });
      throw error;
    }
  },

  createTenant: async (tenantData) => {
    try {
      return await prisma.tenant.create({
        data: tenantData
      });
    } catch (error) {
      logger.error('Error creating tenant:', { error: error.message });
      throw error;
    }
  },

  updateTenant: async (id, updates, updatedBy) => {
    const updatedTenant = await tenantRepository.updateTenant(id, updates);
    if (logEvent) logEvent('tenant_updated', { tenantId: id, updatedBy, updates });
    return updatedTenant;
  },

  deleteTenant: async (id, deletedBy) => {
    const deletedTenant = await tenantRepository.deleteTenant(id);
    if (logEvent) logEvent('tenant_deleted', { tenantId: id, deletedBy });
    return deletedTenant;
  },
  getInstitutionDetails: async (tenantId) => {
    const details = await tenantRepository.findInstitutionDetails(tenantId);
    if (!details) throw new Error('Institution not found');
    return details;
  },
  registerUserWithRolesAndDepartment: async ({ email, firstName, lastName, password, departmentRoles, tenantId, createdBy, roleIds }) => {
    return prisma.$transaction(async (tx) => {
      // 1. Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 2. Create user
      const user = await tx.user.create({
        data: {
          email,
          firstName,
          lastName,
          password: hashedPassword,
          tenant: { connect: { id: tenantId } },
          verified: true,
          createdBy,
        },
      });

      // 3. Assign department-role pairs
      if (Array.isArray(departmentRoles) && departmentRoles.length > 0) {
        // Fetch HOD and HOD AUDITOR roles for this tenant
        const hodRoles = await getHodRolesForTenant(tenantId, tx);
        const hodRoleIds = hodRoles.map(r => r.id);
        
        // TENANT VALIDATION: Verify all roles belong to the correct tenant
        const roleIdsToValidate = departmentRoles.map(dr => dr.roleId).filter(Boolean);
        if (roleIdsToValidate.length > 0) {
          const roleValidation = await tx.role.findMany({
            where: { 
              id: { in: roleIdsToValidate },
              tenantId: tenantId // Must belong to same tenant
            },
            select: { id: true, name: true }
          });
          
          const validRoleIds = roleValidation.map(r => r.id);
          const invalidRoles = departmentRoles.filter(dr => dr.roleId && !validRoleIds.includes(dr.roleId));
          
          if (invalidRoles.length > 0) {
            logger.error('Cross-tenant role assignment attempted', {
              userId: user.id,
              tenantId,
              invalidRoles: invalidRoles.map(r => r.roleId)
            });
            throw new Error(`Invalid role assignment: ${invalidRoles.length} role(s) do not belong to this tenant`);
          }
        }
        
        for (const dr of departmentRoles) {
          await tx.userDepartmentRole.create({
            data: {
              userId: user.id,
              departmentId: dr.departmentId || null,
              roleId: dr.roleId,
              isPrimaryDepartment: !!dr.isPrimaryDepartment,
              isPrimaryRole: !!dr.isPrimaryRole,
            },
          });
          // HOD logic: assign as HOD if role is HOD or HOD AUDITOR
          if (hodRoleIds.includes(dr.roleId) && dr.departmentId) {
            logger.info('HOD assignment triggered', {
              userId: user.id,
              roleId: dr.roleId,
              departmentId: dr.departmentId,
              tenantId
            });
            
            // Find previous HOD
            const prevDept = await tx.department.findUnique({ where: { id: dr.departmentId } });
            if (prevDept && prevDept.hodId && prevDept.hodId !== user.id) {
              const staffRole = await getStaffRoleForTenant(tenantId, tx);
              await tx.userRole.deleteMany({ where: { userId: prevDept.hodId, roleId: { in: hodRoleIds } } });
              await tx.userRole.create({ data: { userId: prevDept.hodId, roleId: staffRole.id } });
              logger.info('Previous HOD demoted to staff', { previousHodId: prevDept.hodId, departmentId: dr.departmentId });
            }
            await tx.department.update({ where: { id: dr.departmentId }, data: { hodId: user.id } });
            logger.info('Department HOD updated', { departmentId: dr.departmentId, newHodId: user.id });
          }
        }
      }

      // 4. Assign global/tenant roles if provided
      if (Array.isArray(roleIds) && roleIds.length > 0) {
        // TENANT VALIDATION: Verify all roles belong to the correct tenant
        const roleValidation = await tx.role.findMany({
          where: { 
            id: { in: roleIds },
            tenantId: tenantId // Must belong to same tenant
          },
          select: { id: true, name: true }
        });
        
        const validRoleIds = roleValidation.map(r => r.id);
        const invalidRoleIds = roleIds.filter(id => !validRoleIds.includes(id));
        
        if (invalidRoleIds.length > 0) {
          logger.error('Cross-tenant user role assignment attempted', {
            userId: user.id,
            tenantId,
            invalidRoleIds
          });
          throw new Error(`Invalid user role assignment: ${invalidRoleIds.length} role(s) do not belong to this tenant`);
        }
        
        for (const roleId of roleIds) {
          await tx.userRole.create({
            data: {
              userId: user.id,
              roleId: roleId,
            },
          });
        }
      }

      // Log role assignment
      logger.info('User created with departmentRoles and userRoles', {
        userId: user.id,
        departmentRoles,
        roleIds,
        tenantId,
      });

      // Return formatted user data for consistency
      const formattedUser = await tx.user.findUnique({
        where: { id: user.id },
        include: {
          tenant: true,
          campus: true,
          userRoles: {
            include: {
              role: true
            }
          },
          userDepartmentRoles: {
            include: {
              role: true,
              department: true
            }
          }
        }
      });

      // Import and use the formatter from userService
      const userService = require('./userService');
      return userService.formatUserData(formattedUser);
    });
  },

  updateUserWithRolesAndDepartment: async ({ userId, tenantId, updateData, updatedBy, defaultRole }) => {
    const startTime = Date.now();
    
    try {
      return await prisma.$transaction(async (tx) => {
      // 1. Verify user exists and belongs to tenant
      const existingUser = await tx.user.findFirst({
        where: {
          id: userId,
          tenantId: tenantId,
        },
        include: {
          userDepartmentRoles: true,
        },
      });

      if (!existingUser) {
        throw new Error('User not found or does not belong to this tenant');
      }

      // 2. Prepare update data
      const userUpdateData = {
        ...(updateData.email !== undefined && { email: updateData.email }),
        ...(updateData.firstName !== undefined && { firstName: updateData.firstName }),
        ...(updateData.lastName !== undefined && { lastName: updateData.lastName }),
        // phone removed, as it does not exist in the User model
        ...(updateData.verified !== undefined && { verified: updateData.verified }),
      };

      // 3. Update user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: userUpdateData,
        include: {
          userDepartmentRoles: true,
        },
      });

      // 4. Update department-role pairs if provided
      if (updateData.departmentRoles) {
        // TENANT VALIDATION: Verify all roles belong to the correct tenant
        const roleIdsToValidate = updateData.departmentRoles.map(dr => dr.roleId).filter(Boolean);
        if (roleIdsToValidate.length > 0) {
          const roleValidation = await tx.role.findMany({
            where: { 
              id: { in: roleIdsToValidate },
              tenantId: tenantId // Must belong to same tenant
            },
            select: { id: true, name: true }
          });
          
          const validRoleIds = roleValidation.map(r => r.id);
          const invalidRoles = updateData.departmentRoles.filter(dr => dr.roleId && !validRoleIds.includes(dr.roleId));
          
          if (invalidRoles.length > 0) {
            logger.error('Cross-tenant role assignment attempted in update', {
              userId,
              tenantId,
              invalidRoles: invalidRoles.map(r => r.roleId)
            });
            throw new Error(`Invalid role assignment: ${invalidRoles.length} role(s) do not belong to this tenant`);
          }
        }
        
        // Remove all existing department-role pairs
        await tx.userDepartmentRole.deleteMany({ where: { userId: userId } });
        
        // Fetch HOD and HOD AUDITOR roles for this tenant once
        const hodRoles = await getHodRolesForTenant(tenantId, tx);
        const hodRoleIds = hodRoles.map(r => r.id);
        
        // Collect all department IDs that need HOD checks
        const departmentIds = updateData.departmentRoles
          .filter(dr => dr.departmentId && hodRoleIds.includes(dr.roleId))
          .map(dr => dr.departmentId);
        
        // Batch fetch all relevant departments once
        const relevantDepartments = departmentIds.length > 0 
          ? await tx.department.findMany({
              where: { id: { in: departmentIds } }
            })
          : [];
        
        // Get staff role once if needed
        let staffRole = null;
        const needsStaffRole = relevantDepartments.some(dept => dept.hodId && dept.hodId !== userId);
        if (needsStaffRole) {
          staffRole = await getStaffRoleForTenant(tenantId, tx);
        }
        
        // Prepare batch operations
        const departmentRoleCreations = [];
        const departmentUpdates = [];
        const userRoleDeletions = [];
        const userRoleCreations = [];
        
        // Process each department-role pair
        for (const dr of updateData.departmentRoles) {
          // Create department-role pair
          departmentRoleCreations.push({
            userId: userId,
            departmentId: dr.departmentId || null,
            roleId: dr.roleId,
            isPrimaryDepartment: !!dr.isPrimaryDepartment,
            isPrimaryRole: !!dr.isPrimaryRole,
          });
          
          // HOD logic: assign as HOD if role is HOD or HOD AUDITOR
          if (hodRoleIds.includes(dr.roleId) && dr.departmentId) {
            const dept = relevantDepartments.find(d => d.id === dr.departmentId);
            if (dept) {
              // If there's a previous HOD and it's not the current user
              if (dept.hodId && dept.hodId !== userId && staffRole) {
                userRoleDeletions.push({ userId: dept.hodId, roleId: { in: hodRoleIds } });
                userRoleCreations.push({ userId: dept.hodId, roleId: staffRole.id });
              }
              // Set current user as HOD
              departmentUpdates.push({ id: dr.departmentId, hodId: userId });
            }
          } else if (dr.departmentId) {
            // If user is not HOD for this department, and was previously HOD, clear hodId
            const dept = relevantDepartments.find(d => d.id === dr.departmentId);
            if (dept && dept.hodId === userId) {
              departmentUpdates.push({ id: dr.departmentId, hodId: null });
            }
          }
        }
        
        // Execute batch operations
        if (departmentRoleCreations.length > 0) {
          await tx.userDepartmentRole.createMany({
            data: departmentRoleCreations
          });
        }
        
        // Handle user role deletions for previous HODs
        for (const deletion of userRoleDeletions) {
          await tx.userRole.deleteMany({ where: deletion });
        }
        
        // Handle user role creations for previous HODs
        for (const creation of userRoleCreations) {
          await tx.userRole.create({ data: creation });
        }
        
        // Handle department updates
        for (const update of departmentUpdates) {
          await tx.department.update({ 
            where: { id: update.id }, 
            data: { hodId: update.hodId } 
          });
        }
      }
      // 5. Update userRoles (global/tenant roles) if provided
      if (updateData.roleIds) {
        // TENANT VALIDATION: Verify all roles belong to the correct tenant
        if (updateData.roleIds.length > 0) {
          const roleValidation = await tx.role.findMany({
            where: { 
              id: { in: updateData.roleIds },
              tenantId: tenantId // Must belong to same tenant
            },
            select: { id: true, name: true }
          });
          
          const validRoleIds = roleValidation.map(r => r.id);
          const invalidRoleIds = updateData.roleIds.filter(id => !validRoleIds.includes(id));
          
          if (invalidRoleIds.length > 0) {
            logger.error('Cross-tenant user role assignment attempted in update', {
              userId,
              tenantId,
              invalidRoleIds
            });
            throw new Error(`Invalid user role assignment: ${invalidRoleIds.length} role(s) do not belong to this tenant`);
          }
        }
        
        // Remove all existing userRoles
        await tx.userRole.deleteMany({ where: { userId: userId } });
        
        // Add new userRoles using batch create
        if (updateData.roleIds.length > 0) {
          const userRoleData = updateData.roleIds.map(roleId => ({
            userId: userId,
            roleId: roleId,
          }));
          
          await tx.userRole.createMany({
            data: userRoleData
          });
        }
      }

      // 6. Set default role if provided
      if (defaultRole && defaultRole.id && defaultRole.type) {
        // Clear all isDefault flags for this user
        await tx.userRole.updateMany({ where: { userId }, data: { isDefault: false } });
        await tx.userDepartmentRole.updateMany({ where: { userId }, data: { isDefault: false } });
        if (defaultRole.type === 'userRole') {
          await tx.userRole.updateMany({ where: { userId, roleId: defaultRole.id }, data: { isDefault: true } });
        } else if (defaultRole.type === 'userDepartmentRole') {
          await tx.userDepartmentRole.updateMany({ where: { userId, roleId: defaultRole.id }, data: { isDefault: true } });
        }
      }

      // Log department-role update
      logger.info('User departmentRoles updated', {
        userId,
        newDepartmentRoles: updateData.departmentRoles,
        tenantId,
      });

      // 7. Return updated user with departmentRoles and userRoles (with details)
      const finalUser = await tx.user.findUnique({
        where: { id: userId },
        include: {
          userDepartmentRoles: {
            include: {
              department: true,
              role: true,
            }
          },
          userRoles: {
            include: {
              role: true,
            }
          }
        },
      });

      return finalUser;
    }, {
      timeout: 15000, // Increase timeout to 15 seconds
    });
    
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      logger.error('Failed to update user with roles and department', {
        userId,
        tenantId,
        duration,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    } finally {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (duration > 3000) { // Log slow transactions
        logger.warn('Slow user update transaction', {
          userId,
          tenantId,
          duration
        });
      }
    }
  },
  deleteUserFromTenant: async ({ userId, tenantId, deletedBy }) => {
    return prisma.$transaction(async (tx) => {
      // 1. Verify user exists and belongs to tenant
      const existingUser = await tx.user.findFirst({
        where: {
          id: userId,
          tenantId: tenantId
        }
      });

      if (!existingUser) {
        throw new Error('User not found or does not belong to this tenant');
      }

      // 2. Check if user is HOD of any department
      const departmentsWithHod = await tx.department.findMany({
        where: {
          hodId: userId,
          tenantId: tenantId
        }
      });

      if (departmentsWithHod.length > 0) {
        throw new Error('Cannot delete user who is Head of Department. Please reassign HOD first.');
      }

      // 3. Delete user roles first
      await tx.userRole.deleteMany({
        where: { userId: userId }
      });

      // 4. Delete user
      await tx.user.delete({
        where: { id: userId }
      });

      return { success: true };
    });
  },
  getTenantsWithStats: async ({ page, limit, offset, search }) => {
    const whereClause = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { domain: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const [tenants, totalCount] = await Promise.all([
      prisma.tenant.findMany({
        where: whereClause,
        skip: offset,
        take: limit,
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
      prisma.tenant.count({ where: whereClause })
    ]);

    return {
      tenants,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  },
  getTenantAnalytics: async (tenantId) => {
    const [
      userCount,
      activeUserCount,
      departmentCount,
      campusCount,
      recentUsers,
      userGrowth
    ] = await Promise.all([
      // Total users
      prisma.user.count({ where: { tenantId } }),
      
      // Active users (verified)
      prisma.user.count({ 
        where: { 
          tenantId,
          verified: true 
        } 
      }),
      
      // Department count
      prisma.department.count({ where: { tenantId } }),
      
      // Campus count
      prisma.campus.count({ where: { tenantId } }),
      
      // Recent users (last 10)
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
          createdAt: true
        }
      }),
      
      // User growth over time (last 6 months)
      prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          tenantId,
          createdAt: {
            gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) // 6 months ago
          }
        },
        _count: {
          id: true
        }
      })
    ]);

    return {
      userCount,
      activeUserCount,
      departmentCount,
      campusCount,
      recentUsers,
      userGrowth
    };
  },
  getTenantDistributionByCounty: async () => {
    // We use _all and count distinct tenantIds in memory, as Prisma's groupBy count is not distinct yet.
    const tenantCounts = await prisma.campus.findMany({
      where: {
        isMain: true,
        county: {
          not: null,
        },
      },
      select: {
        county: true,
        tenantId: true,
      },
    });

    const counts = tenantCounts.reduce((acc, { county, tenantId }) => {
      if (!acc[county]) {
        acc[county] = new Set();
      }
      acc[county].add(tenantId);
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([county, tenants]) => ({
        county,
        tenantCount: tenants.size,
      }))
      .sort((a, b) => b.tenantCount - a.tenantCount);
  },
  getUsersForTenant: async (tenantId) => {
    logger.info('Getting users for tenant', { tenantId });
    
    const users = await prisma.user.findMany({
      where: { tenantId },
      include: {
        tenant: true,
        campus: true,
        userRoles: { 
          include: { 
            role: true 
          } 
        },
        userDepartmentRoles: {
          include: {
            department: true,
            role: true,
          }
        },
      },
      orderBy: { firstName: 'asc' },
    });
    
    logger.info('Users found for tenant', { tenantId, count: users.length });
    
    // Use the standardized formatter for consistency
    const userService = require('./userService');
    return users.map(user => userService.formatUserData(user));
  },
};

module.exports = tenantService;