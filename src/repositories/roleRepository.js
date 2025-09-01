const { prisma } = require('../../prisma/client');

const roleRepository = {
  findRoleById: async (id, tenantId) => {
    if (tenantId) {
      return prisma.role.findFirst({ 
        where: { 
          id,
          tenantId 
        } 
      });
    }
    return prisma.role.findUnique({ where: { id } });
  },

  findRolesByIds: async (ids) => {
    return prisma.role.findMany({ where: { id: { in: ids } } });
  },

  findAllRoles: async () => {
    return prisma.role.findMany({
      select: { id: true, name: true, description: true, tenantId: true },
    });
  },

  findRolesByTenant: async (tenantId) => {
    console.log('Repository: Finding roles by tenant', { tenantId });
    
    try {
      const roles = await prisma.role.findMany({
        where: { tenantId },
        select: { 
          id: true, 
          name: true, 
          description: true, 
          tenantId: true,
          roleScope: true,
          loginDestination: true,
          defaultContext: true,
          isDefault: true,
          isRemovable: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { name: 'asc' }
      });
      
      console.log('Repository: Roles found', { 
        tenantId, 
        roleCount: roles.length,
        roleNames: roles.map(r => r.name)
      });
      
      return roles;
    } catch (error) {
      console.error('Repository: Error finding roles by tenant', { 
        tenantId, 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  },

  createRole: async (data, tx = prisma) => {
    return tx.role.create({ data });
  },

  updateRole: async (id, data) => {
    return prisma.role.update({ where: { id }, data });
  },

  deleteRole: async (id) => {
    return prisma.role.delete({ where: { id } });
  },

  assignRolesToUser: async (userId, roleIds) => {
    await prisma.userRole.deleteMany({ where: { userId } });
    const userRoleData = roleIds.map((roleId) => ({ userId, roleId }));
    return prisma.userRole.createMany({ data: userRoleData, skipDuplicates: true });
  },
};

module.exports = roleRepository;