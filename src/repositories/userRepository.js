const { prisma } = require('../../prisma/client');

const userRepository = {
  createUser: async (userData) => {
    return prisma.user.create({ data: userData });
  },

  findUserById: async (id) => {
    return prisma.user.findUnique({ 
      where: { id },
      include: {
        tenant: true,
        campus: true
      }
    });
  },

  findUserByEmail: async (email) => {
    return prisma.user.findUnique({
      where: { email },
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
  },

  findUsersByTenant: async (tenantId) => {
    return prisma.user.findMany({
      where: { tenantId },
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
      orderBy: { firstName: 'asc' }
    });
  },

  updateUser: async (id, data) => {
    return prisma.user.update({ where: { id }, data });
  },

  deleteUser: async (id) => {
    return prisma.user.delete({ where: { id } });
  },

  // User Role Management
  getUserRoles: async (userId) => {
    return prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true
      }
    });
  },

  getUserDepartmentRoles: async (userId) => {
    return prisma.userDepartmentRole.findMany({
      where: { userId },
      include: {
        role: true,
        department: true
      }
    });
  },

  createUserRoles: async (userRoles) => {
    return prisma.userRole.createMany({
      data: userRoles,
      skipDuplicates: true
    });
  },

  createUserDepartmentRoles: async (userDepartmentRoles) => {
    return prisma.userDepartmentRole.createMany({
      data: userDepartmentRoles,
      skipDuplicates: true
    });
  },

  deleteUserRoles: async (userId) => {
    return prisma.userRole.deleteMany({ where: { userId } });
  },

  deleteUserDepartmentRoles: async (userId) => {
    return prisma.userDepartmentRole.deleteMany({ where: { userId } });
  },

  setDefaultUserRole: async (userId, roleId) => {
    // First, unset all default roles
    await prisma.userRole.updateMany({
      where: { userId },
      data: { isDefault: false }
    });

    // Set the new default role
    return prisma.userRole.update({
      where: { userId_roleId: { userId, roleId } },
      data: { isDefault: true }
    });
  },

  setDefaultUserDepartmentRole: async (userId, departmentId, roleId) => {
    // First, unset all default department roles for this user
    await prisma.userDepartmentRole.updateMany({
      where: { userId },
      data: { isDefault: false }
    });

    // Set the new default department role
    return prisma.userDepartmentRole.update({
      where: { 
        userId_departmentId_roleId: { 
          userId, 
          departmentId, 
          roleId 
        } 
      },
      data: { isDefault: true }
    });
  },

  // Get user's default role
  getUserDefaultRole: async (userId) => {
    // Check for default department role first
    const defaultDepartmentRole = await prisma.userDepartmentRole.findFirst({
      where: {
        userId,
        isDefault: true
      },
      include: {
        role: true,
        department: true
      }
    });

    if (defaultDepartmentRole) {
      return {
        type: 'department',
        role: defaultDepartmentRole.role,
        department: defaultDepartmentRole.department
      };
    }

    // Check for default tenant role
    const defaultTenantRole = await prisma.userRole.findFirst({
      where: {
        userId,
        isDefault: true
      },
      include: {
        role: true
      }
    });

    if (defaultTenantRole) {
      return {
        type: 'tenant',
        role: defaultTenantRole.role
      };
    }

    return null;
  }
};

module.exports = userRepository; 