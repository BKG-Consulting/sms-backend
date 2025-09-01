// src/services/userService.js
const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger');
const { AppError } = require('../../errors/app.error');
const bcrypt = require('bcryptjs');
const { sendUserInvitationEmail } = require('../utils/emailUtils');

// Standardized user data formatter to ensure consistent structure
const formatUserData = (user) => {
  if (!user) return null;

  // Build roles array with department context
  const departmentRoles = (user.userDepartmentRoles || []).map(udr => ({
    id: udr.id,
    department: udr.department ? { 
      id: udr.department.id, 
      name: udr.department.name,
      code: udr.department.code 
    } : null,
    role: udr.role ? { 
      id: udr.role.id, 
      name: udr.role.name,
      description: udr.role.description,
      roleScope: udr.role.roleScope
    } : null,
    isPrimaryDepartment: udr.isPrimaryDepartment || false,
    isPrimaryRole: udr.isPrimaryRole || false,
    isDefault: udr.isDefault || false,
  }));

  // Build system roles array (tenant-wide roles)
  const systemRoles = (user.userRoles || []).map(ur => ({
    id: ur.id,
    role: ur.role ? { 
      id: ur.role.id, 
      name: ur.role.name,
      description: ur.role.description,
      roleScope: ur.role.roleScope,
      loginDestination: ur.role.loginDestination
    } : null,
    isDefault: ur.isDefault || false,
  }));

  // Determine primary department and role
  const primaryDepartmentRole = departmentRoles.find(dr => dr.isPrimaryDepartment) || departmentRoles[0];
  const primarySystemRole = systemRoles.find(sr => sr.isDefault) || systemRoles[0];

  // Determine default role
  let defaultRole = null;
  const defaultDepartmentRole = departmentRoles.find(dr => dr.isDefault);
  const defaultSystemRole = systemRoles.find(sr => sr.isDefault);

  if (defaultDepartmentRole) {
    defaultRole = {
      id: defaultDepartmentRole.role.id,
      name: defaultDepartmentRole.role.name,
      type: 'department',
      department: defaultDepartmentRole.department
    };
  } else if (defaultSystemRole) {
    defaultRole = {
      id: defaultSystemRole.role.id,
      name: defaultSystemRole.role.name,
      type: 'system'
    };
  }

  // Build departments array
  const departments = departmentRoles
    .filter(dr => dr.department)
    .map(dr => dr.department);

  // Build roles array (flattened for backward compatibility)
  const roles = [
    ...systemRoles.map(sr => ({ ...sr.role, type: 'system' })),
    ...departmentRoles.map(dr => ({ ...dr.role, type: 'department', department: dr.department }))
  ].filter(Boolean);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    verified: user.verified || false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    tenantId: user.tenantId,
    campusId: user.campusId,
    
    // Tenant and campus info
    tenant: user.tenant ? {
      id: user.tenant.id,
      name: user.tenant.name,
      domain: user.tenant.domain,
      logoUrl: user.tenant.logoUrl
    } : null,
    campus: user.campus ? {
      id: user.campus.id,
      name: user.campus.name
    } : null,

    // Role and department assignments
    userDepartmentRoles: departmentRoles,
    userRoles: systemRoles,
    
    // Primary assignments
    primaryDepartment: primaryDepartmentRole?.department || null,
    primaryRole: primaryDepartmentRole?.role || primarySystemRole?.role || null,
    
    // Default role
    defaultRole,
    
    // Flattened arrays for backward compatibility
    roles,
    departments,
    
    // Role names for easy access
    roleNames: roles.map(r => r.name),
    departmentNames: departments.map(d => d.name),
    
    // Display helpers
    displayName: `${user.firstName} ${user.lastName}`,
    isActive: user.verified || false
  };
};

const userService = {
  // Make formatUserData available as a method
  formatUserData,
  createUser: async (userData) => {
    try {
      const { 
        password, 
        roleIds, 
        defaultRoleId, 
        departmentId, 
        departmentRoles, 
        departmentAssignments, 
        systemRoles, 
        ...userInfo 
      } = userData;
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email }
      });

      if (existingUser) {
        throw new AppError('User with this email already exists', 409);
      }

      // Hash password if provided, otherwise create user without password
      let hashedPassword = null;
      if (password) {
        // Validate password strength
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
          throw new AppError('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character', 400);
        }
        hashedPassword = await bcrypt.hash(password, 12);
      }

      // Create user with transaction to handle role assignments
      const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            ...userInfo,
            password: hashedPassword,
            verified: !password ? false : true, // If no password, user needs to verify email
          },
          include: {
            tenant: true,
            campus: true
          }
        });

        // Assign system roles (tenant-wide roles) if provided
        if (systemRoles && Array.isArray(systemRoles) && systemRoles.length > 0) {
          // Validate all roles belong to the correct tenant
          const roleIdsToValidate = systemRoles.map(sr => sr.roleId);
          const roleValidation = await tx.role.findMany({
            where: { 
              id: { in: roleIdsToValidate },
              tenantId: userData.tenantId
            },
            select: { id: true, name: true }
          });
          
          const validRoleIds = roleValidation.map(r => r.id);
          const invalidRoleIds = roleIdsToValidate.filter(id => !validRoleIds.includes(id));
          
          if (invalidRoleIds.length > 0) {
            throw new AppError(`Invalid system role assignment: ${invalidRoleIds.length} role(s) do not belong to this tenant`, 400);
          }

          const userRoles = systemRoles.map(sr => ({
            userId: newUser.id,
            roleId: sr.roleId,
            isDefault: sr.isDefault || false
          }));

          await tx.userRole.createMany({
            data: userRoles,
            skipDuplicates: true
          });
        } else if (roleIds && roleIds.length > 0) {
          // Legacy role assignment for backward compatibility
          const userRoles = roleIds.map(roleId => ({
            userId: newUser.id,
            roleId,
            isDefault: defaultRoleId === roleId
          }));

          await tx.userRole.createMany({
            data: userRoles,
            skipDuplicates: true
          });
        }

        // Handle department assignments (new departmentAssignments structure or legacy departmentRoles/departmentId)
        if (departmentAssignments && Array.isArray(departmentAssignments) && departmentAssignments.length > 0) {
          // New multi-department assignment structure from frontend
          for (const assignment of departmentAssignments) {
            // Validate department and role belong to the correct tenant
            const [department, role] = await Promise.all([
              tx.department.findFirst({
                where: { 
                  id: assignment.departmentId,
                  tenantId: userData.tenantId
                }
              }),
              tx.role.findFirst({
                where: { 
                  id: assignment.roleId,
                  tenantId: userData.tenantId
                }
              })
            ]);

            if (!department) {
              throw new AppError(`Department ${assignment.departmentId} does not belong to this tenant`, 400);
            }

            if (!role) {
              throw new AppError(`Role ${assignment.roleId} does not belong to this tenant`, 400);
            }

            await tx.userDepartmentRole.create({
              data: {
                userId: newUser.id,
                departmentId: assignment.departmentId,
                roleId: assignment.roleId,
                isPrimaryDepartment: assignment.isPrimary || false,
                isDefault: assignment.isDefault || false
              }
            });

            // Check if user has HOD role and assign as department HOD
            if (role.name === 'HOD' || role.name === 'HOD_AUDITOR' || role.name === 'HOD AUDITOR') {
              // Update department to set this user as HOD
              await tx.department.update({
                where: { id: assignment.departmentId },
                data: { hodId: newUser.id }
              });

              logger.info('User assigned as department HOD', {
                userId: newUser.id,
                departmentId: assignment.departmentId,
                roleId: role.id,
                roleName: role.name
              });
            }
          }
        } else if (departmentRoles && Array.isArray(departmentRoles) && departmentRoles.length > 0) {
          // Legacy departmentRoles structure
          for (const deptRole of departmentRoles) {
            await tx.userDepartmentRole.create({
              data: {
                userId: newUser.id,
                departmentId: deptRole.departmentId,
                roleId: deptRole.roleId,
                isPrimaryDepartment: deptRole.isPrimaryDepartment || false,
                isDefault: deptRole.isDefault || false
              }
            });

            // Check if user has HOD role and assign as department HOD
            const hodRole = await tx.role.findFirst({
              where: {
                id: deptRole.roleId,
                name: { in: ['HOD', 'HOD_AUDITOR', 'HOD AUDITOR'] }
              }
            });

            if (hodRole) {
              // Update department to set this user as HOD
              await tx.department.update({
                where: { id: deptRole.departmentId },
                data: { hodId: newUser.id }
              });

              logger.info('User assigned as department HOD', {
                userId: newUser.id,
                departmentId: deptRole.departmentId,
                roleId: hodRole.id,
                roleName: hodRole.name
              });
            }
          }
        } else if (departmentId) {
          // Legacy single department assignment
          const staffRole = await tx.role.findFirst({
            where: {
              name: 'STAFF',
              tenantId: userData.tenantId
            }
          });

          if (staffRole) {
            await tx.userDepartmentRole.create({
              data: {
                userId: newUser.id,
                departmentId,
                roleId: staffRole.id,
                isDefault: !defaultRoleId || defaultRoleId === staffRole.id
              }
            });
          }

          // Check if user has HOD role and assign as department HOD
          if (roleIds && roleIds.length > 0) {
            const hodRole = await tx.role.findFirst({
              where: {
                id: { in: roleIds },
                name: { in: ['HOD', 'HOD_AUDITOR', 'HOD AUDITOR'] }
              }
            });

            if (hodRole) {
              // Update department to set this user as HOD
              await tx.department.update({
                where: { id: departmentId },
                data: { hodId: newUser.id }
              });

              logger.info('User assigned as department HOD', {
                userId: newUser.id,
                departmentId,
                roleId: hodRole.id,
                roleName: hodRole.name
              });
            }
          }
        }

        return newUser;
      });

      // Fetch the complete user data with role assignments
      const completeUser = await prisma.user.findUnique({
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

      // Send invitation email if no password was provided
      if (!password) {
        try {
          // Get tenant information for the invitation email
          const tenant = await prisma.tenant.findUnique({
            where: { id: userData.tenantId },
            select: { name: true }
          });
          
          // Generate invitation link (you might want to create a proper invitation token system)
          const invitationLink = `${process.env.CLIENT_URL || 'https://dual-dimension-consulting.vercel.app'}/auth/setup-account?email=${encodeURIComponent(completeUser.email)}&token=${completeUser.id}`;
          
          // Send invitation email
          await sendUserInvitationEmail(completeUser.email, invitationLink, tenant?.name || 'Your Institution');
          
          logger.info('User invitation email sent successfully', {
            userId: completeUser.id,
            email: completeUser.email
          });
        } catch (emailError) {
          logger.error('Failed to send user invitation email', {
            userId: completeUser.id,
            email: completeUser.email,
            error: emailError.message
          });
          // Don't fail the user creation if email fails
        }
      }

      logger.info('User created successfully', {
        userId: completeUser.id,
        email: completeUser.email,
        hasPassword: !!password,
        roleCount: (systemRoles?.length || 0) + (departmentAssignments?.length || 0)
      });

      return formatUserData(completeUser);
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  getCurrentUser: async (userId) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
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

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return formatUserData(user);
    } catch (error) {
      logger.error('Error fetching current user:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  getUserById: async (id) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          tenant: true,
          campus: true,
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
              },
              department: true
            }
          }
        }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      return formatUserData(user);
    } catch (error) {
      logger.error('Error fetching user by ID:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  deleteAccount: async (userId) => {
    try {
      await prisma.$transaction(async (tx) => {
        // Delete user's sessions
        await tx.session.deleteMany({
          where: { userId }
        });

        // Delete user's refresh tokens
        await tx.refreshToken.deleteMany({
          where: { userId }
        });

        // Delete user's login attempts
        await tx.loginAttempt.deleteMany({
          where: { userId }
        });

        // Delete user's password history
        await tx.passwordHistory.deleteMany({
          where: { userId }
        });

        // Delete user's OTPs
        await tx.oTP.deleteMany({
          where: { userId }
        });

        // Delete user's notifications
        await tx.notification.deleteMany({
          where: { targetUserId: userId }
        });

        // Delete user's messages
        await tx.message.deleteMany({
          where: {
            OR: [
              { senderId: userId },
              { recipientId: userId }
            ]
          }
        });

        // Delete user's user roles
        await tx.userRole.deleteMany({
          where: { userId }
        });

        // Delete user's department roles
        await tx.userDepartmentRole.deleteMany({
          where: { userId }
        });

        // Delete user's user permissions
        await tx.userPermission.deleteMany({
          where: { userId }
        });

        // Finally delete the user
        await tx.user.delete({
          where: { id: userId }
        });
      });

      logger.info('User account deleted successfully', { userId });
    } catch (error) {
      logger.error('Error deleting user account:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  getUsersByRoleAndTenant: async (roleId, tenantId) => {
    try {
      const users = await prisma.user.findMany({
        where: {
          tenantId,
          OR: [
            { userRoles: { some: { roleId } } },
            { userDepartmentRoles: { some: { roleId } } }
          ]
        },
        include: {
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

      return users;
    } catch (error) {
      logger.error('Error fetching users by role and tenant:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  getHODs: async (tenantId) => {
    try {
      // Find HOD role
      const hodRole = await prisma.role.findFirst({
        where: {
          name: 'HOD',
          tenantId
        }
      });

      if (!hodRole) {
        return [];
      }

      // Find users with HOD role
      const hods = await prisma.user.findMany({
        where: {
          tenantId,
          OR: [
            { userRoles: { some: { roleId: hodRole.id } } },
            { userDepartmentRoles: { some: { roleId: hodRole.id } } }
          ]
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          userDepartmentRoles: {
            where: { roleId: hodRole.id },
            include: {
              department: true
            }
          }
        }
      });

      return hods;
    } catch (error) {
      logger.error('Error fetching HODs:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  // Get all department heads (HODs and HOD AUDITORs) for document ownership
  getDepartmentHeads: async (tenantId) => {
    try {
      // Find both HOD and HOD AUDITOR roles
      const hodRoles = await prisma.role.findMany({
        where: {
          name: { in: ['HOD', 'HOD AUDITOR'] },
          tenantId
        }
      });

      if (hodRoles.length === 0) {
        return [];
      }

      const roleIds = hodRoles.map(role => role.id);

      // Find users with HOD or HOD AUDITOR roles
      const departmentHeads = await prisma.user.findMany({
        where: {
          tenantId,
          OR: [
            { userRoles: { some: { roleId: { in: roleIds } } } },
            { userDepartmentRoles: { some: { roleId: { in: roleIds } } } }
          ]
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          userDepartmentRoles: {
            where: { roleId: { in: roleIds } },
            include: {
              role: true,
              department: true
            }
          },
          headedDepartments: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });

      // Format the response to include role information
      const formattedHeads = departmentHeads.map(user => {
        const roles = [];
        const departments = [];

        // Add roles from userDepartmentRoles
        user.userDepartmentRoles.forEach(udr => {
          if (!roles.find(r => r.id === udr.role.id)) {
            roles.push({
              id: udr.role.id,
              name: udr.role.name
            });
          }
          if (!departments.find(d => d.id === udr.department.id)) {
            departments.push({
              id: udr.department.id,
              name: udr.department.name,
              code: udr.department.code
            });
          }
        });

        // Add departments from headedDepartments
        user.headedDepartments.forEach(dept => {
          if (!departments.find(d => d.id === dept.id)) {
            departments.push({
              id: dept.id,
              name: dept.name,
              code: dept.code
            });
          }
        });

        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roles,
          departments,
          displayName: `${user.firstName} ${user.lastName}`,
          roleNames: roles.map(r => r.name).join(', '),
          departmentNames: departments.map(d => d.name).join(', ')
        };
      });

      return formattedHeads;
    } catch (error) {
      logger.error('Error fetching department heads:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  getAllUsers: async ({ page = 1, limit = 10, search, tenantId, departmentId, roleId }) => {
    try {
      const whereClause = {};
      
      if (tenantId) {
        whereClause.tenantId = tenantId;
      }

      // Build search conditions
      const searchConditions = [];
      if (search) {
        searchConditions.push(
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        );
      }

      // Build role conditions
      const roleConditions = [];
      if (roleId) {
        roleConditions.push(
          { userRoles: { some: { roleId } } },
          { userDepartmentRoles: { some: { roleId } } }
        );
      }

      // Combine conditions properly
      if (searchConditions.length > 0 && roleConditions.length > 0) {
        // Both search and role filters: users must match search AND have the role
        whereClause.AND = [
          { OR: searchConditions },
          { OR: roleConditions }
        ];
      } else if (searchConditions.length > 0) {
        // Only search filter
        whereClause.OR = searchConditions;
      } else if (roleConditions.length > 0) {
        // Only role filter
        whereClause.OR = roleConditions;
      }

      if (departmentId) {
        whereClause.userDepartmentRoles = {
          some: { departmentId }
        };
      }

      const skip = (page - 1) * limit;
      const take = limit;

      // Debug logging
      logger.info('User filtering conditions:', {
        tenantId,
        search,
        departmentId,
        roleId,
        whereClause,
        page,
        limit
      });

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where: whereClause,
          include: {
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
          },
          orderBy: { firstName: 'asc' },
          skip,
          take
        }),
        prisma.user.count({ where: whereClause })
      ]);

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('Error fetching all users:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  updateUser: async (id, updateData) => {
    try {
      const { roleIds, ...userData } = updateData;

      const updatedUser = await prisma.$transaction(async (tx) => {
        // Update user data
        const user = await tx.user.update({
          where: { id },
          data: userData,
          include: {
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

        // Update roles if provided
        if (roleIds) {
          // Delete existing roles
          await tx.userRole.deleteMany({
            where: { userId: id }
          });

          // Add new roles
          if (roleIds.length > 0) {
            await tx.userRole.createMany({
              data: roleIds.map(roleId => ({
                userId: id,
                roleId
              }))
            });
          }
        }

        return user;
      });

      return updatedUser;
    } catch (error) {
      logger.error('Error updating user:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  updateUserComprehensive: async (userId, updateData, tenantId) => {
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
            userRoles: {
              include: { role: true }
            },
            userDepartmentRoles: {
              include: { 
                role: true,
                department: true 
              }
            }
          }
        });

        if (!existingUser) {
          throw new AppError('User not found or does not belong to this tenant', 404);
        }

        // 2. Update basic user info if provided
        if (updateData.basicInfo) {
          const userUpdateData = {
            ...(updateData.basicInfo.email !== undefined && { email: updateData.basicInfo.email }),
            ...(updateData.basicInfo.firstName !== undefined && { firstName: updateData.basicInfo.firstName }),
            ...(updateData.basicInfo.lastName !== undefined && { lastName: updateData.basicInfo.lastName }),
            ...(updateData.basicInfo.verified !== undefined && { verified: updateData.basicInfo.verified }),
          };

          if (Object.keys(userUpdateData).length > 0) {
            await tx.user.update({
              where: { id: userId },
              data: userUpdateData
            });
          }
        }

        // 3. Handle role updates if provided
        if (updateData.roleUpdates) {
          const { addRoles, removeRoles, setDefaultRole } = updateData.roleUpdates;

          // Validate roles belong to tenant
          if (addRoles && addRoles.length > 0) {
            const roleIds = addRoles.map(r => r.roleId);
            const validRoles = await tx.role.findMany({
              where: { 
                id: { in: roleIds },
                tenantId: tenantId
              }
            });
            
            if (validRoles.length !== roleIds.length) {
              throw new AppError('Some roles do not belong to this tenant', 400);
            }
          }

          // Remove specified roles
          if (removeRoles && removeRoles.length > 0) {
            await tx.userRole.deleteMany({
              where: {
                userId: userId,
                roleId: { in: removeRoles }
              }
            });
          }

          // Add new roles
          if (addRoles && addRoles.length > 0) {
            const userRoleData = addRoles.map(role => ({
              userId: userId,
              roleId: role.roleId,
              isDefault: role.isDefault || false
            }));

            await tx.userRole.createMany({
              data: userRoleData,
              skipDuplicates: true
            });
          }

          // Set default role
          if (setDefaultRole) {
            // Clear all default flags
            await tx.userRole.updateMany({
              where: { userId: userId },
              data: { isDefault: false }
            });

            // Set new default
            await tx.userRole.updateMany({
              where: { 
                userId: userId,
                roleId: setDefaultRole
              },
              data: { isDefault: true }
            });
          }
        }

        // 4. Handle department updates if provided
        if (updateData.departmentUpdates) {
          const { addDepartments, removeDepartments, setPrimaryDepartment } = updateData.departmentUpdates;

          // Validate departments and roles belong to tenant
          if (addDepartments && addDepartments.length > 0) {
            const departmentIds = addDepartments.map(d => d.departmentId);
            const roleIds = addDepartments.map(d => d.roleId);

            const [validDepartments, validRoles] = await Promise.all([
              tx.department.findMany({
                where: { 
                  id: { in: departmentIds },
                  tenantId: tenantId
                }
              }),
              tx.role.findMany({
                where: { 
                  id: { in: roleIds },
                  tenantId: tenantId
                }
              })
            ]);

            if (validDepartments.length !== departmentIds.length) {
              throw new AppError('Some departments do not belong to this tenant', 400);
            }

            if (validRoles.length !== roleIds.length) {
              throw new AppError('Some roles do not belong to this tenant', 400);
            }
          }

          // Remove specified department roles
          if (removeDepartments && removeDepartments.length > 0) {
            await tx.userDepartmentRole.deleteMany({
              where: {
                userId: userId,
                departmentId: { in: removeDepartments }
              }
            });
          }

          // Add new department roles
          if (addDepartments && addDepartments.length > 0) {
            const userDepartmentRoleData = addDepartments.map(dept => ({
              userId: userId,
              departmentId: dept.departmentId,
              roleId: dept.roleId,
              isPrimaryDepartment: dept.isPrimary || false,
              isPrimaryRole: dept.isPrimary || false,
              isDefault: dept.isDefault || false
            }));

            await tx.userDepartmentRole.createMany({
              data: userDepartmentRoleData,
              skipDuplicates: true
            });

            // Handle HOD logic for new department roles
            const hodRoles = await tx.role.findMany({
              where: {
                name: { in: ['HOD', 'HOD_AUDITOR', 'HOD AUDITOR'] },
                tenantId: tenantId
              }
            });

            const hodRoleIds = hodRoles.map(r => r.id);

            for (const dept of addDepartments) {
              if (hodRoleIds.includes(dept.roleId)) {
                // Set user as HOD for this department
                await tx.department.update({
                  where: { id: dept.departmentId },
                  data: { hodId: userId }
                });
              }
            }
          }

          // Set primary department
          if (setPrimaryDepartment) {
            // Clear all primary flags
            await tx.userDepartmentRole.updateMany({
              where: { userId: userId },
              data: { 
                isPrimaryDepartment: false,
                isPrimaryRole: false
              }
            });

                         // Set new primary
             await tx.userDepartmentRole.updateMany({
               where: { 
                 userId: userId,
                 departmentId: setPrimaryDepartment
               },
               data: { 
                 isPrimaryDepartment: true,
                 isPrimaryRole: true
               }
             });
          }
        }

        // 5. Return updated user with all relationships
        const updatedUser = await tx.user.findUnique({
          where: { id: userId },
          include: {
            userRoles: {
              include: { role: true }
            },
            userDepartmentRoles: {
              include: { 
                role: true,
                department: true 
              }
            },
            tenant: true,
            campus: true
          }
        });

        return updatedUser;
      }, {
        timeout: 15000, // 15 second timeout
      });

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      logger.error('Failed to update user comprehensively', {
        userId,
        tenantId,
        duration,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  },

  deleteUser: async (id) => {
    try {
      await prisma.$transaction(async (tx) => {
        // Delete related records
        await tx.userRole.deleteMany({
          where: { userId: id }
        });

        await tx.userDepartmentRole.deleteMany({
          where: { userId: id }
        });

        await tx.userPermission.deleteMany({
          where: { userId: id }
        });

        // Delete the user
        await tx.user.delete({
          where: { id }
        });
      });

      logger.info('User deleted successfully', { userId: id });
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  setDefaultRole: async (roleId, type, userId) => {
    try {
      if (type === 'userRole') {
        // Set default user role
        await prisma.$transaction(async (tx) => {
          // Unset all default user roles
          await tx.userRole.updateMany({
            where: { userId },
            data: { isDefault: false }
          });

          // Set the new default role
          await tx.userRole.update({
            where: { userId_roleId: { userId, roleId } },
            data: { isDefault: true }
          });
        });
      } else if (type === 'userDepartmentRole') {
        // Set default department role
        await prisma.$transaction(async (tx) => {
          // Unset all default department roles
          await tx.userDepartmentRole.updateMany({
            where: { userId },
            data: { isDefault: false }
          });

          // Set the new default role
          await tx.userDepartmentRole.update({
            where: { userId_roleId: { userId, roleId } },
            data: { isDefault: true }
          });
        });
      }

      logger.info('Default role set successfully', { userId, roleId, type });
    } catch (error) {
      logger.error('Error setting default role:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  updateProfile: async (userId, updateData) => {
    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        include: {
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

      return updatedUser;
    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  changePassword: async (userId, currentPassword, newPassword) => {
    try {
      // Get current user with password
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true }
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        throw new AppError('Current password is incorrect', 400);
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await prisma.$transaction(async (tx) => {
        // Add to password history
        await tx.passwordHistory.create({
          data: {
            userId,
            passwordHash: user.password
          }
        });

        // Update password
        await tx.user.update({
          where: { id: userId },
          data: { password: hashedPassword }
        });
      });

      logger.info('Password changed successfully', { userId });
    } catch (error) {
      logger.error('Error changing password:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  },

  getUsersForTenant: async ({ tenantId, page = 1, limit = 10, search, departmentId, roleId }) => {
    try {
      const skip = (page - 1) * limit;
      
      const whereClause = {
        tenantId,
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } }
          ]
        }),
        ...(departmentId && {
          userDepartmentRoles: {
            some: {
              departmentId
            }
          }
        }),
        ...(roleId && {
          OR: [
            {
              userRoles: {
                some: {
                  roleId
                }
              }
            },
            {
              userDepartmentRoles: {
                some: {
                  roleId
                }
              }
            }
          ]
        })
      };

      const users = await prisma.user.findMany({
        where: whereClause,
        include: {
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
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      });

      const total = await prisma.user.count({
        where: whereClause
      });

      logger.info('Users fetched for tenant', {
        tenantId,
        count: users.length,
        total,
        page,
        limit
      });

      // Use the standardized formatter for consistency
      return users.map(user => formatUserData(user));
    } catch (error) {
      logger.error('Error fetching users for tenant:', error);
      throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
    }
  }
};

module.exports = userService; 