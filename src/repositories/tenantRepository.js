const { prisma } = require('../../prisma/client');

const tenantRepository = {
  findTenantById: async (id) => {
    return prisma.tenant.findUnique({ where: { id } });
  },

  createTenant: async ({ id, name, domain, email, type, createdBy }) => {
    return prisma.tenant.create({
      data: { id, name, domain, email, type, createdBy },
    });
  },

  updateTenant: async (id, updateData) => {
    return prisma.tenant.update({
      where: { id },
      data: { ...updateData },
    });
  },

  getAllTenants: async (options = {}) => {
    return prisma.tenant.findMany({
      ...options,
      orderBy: { createdAt: 'desc' },
    });
  },

  deleteTenant: async (id) => {
    return prisma.tenant.delete({ where: { id } });
  },

  findInstitutionDetails: async (tenantId) => {
    return prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        departments: {
          include: {
            hod: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          }
        },
        roles: true,
        users: {
          include: {
            campus: true,
            userRoles: {
              include: { role: true },
            },
            userDepartmentRoles: {
              include: { department: true, role: true },
            },
          },
        },
      },
    });
  },

  findTenantByDomainWithBranding: async (domain) => {
    return prisma.tenant.findUnique({
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
        taxId: true,
        branding: {
          select: {
            id: true,
            logoUrl: true,
            faviconUrl: true,
            primaryColor: true,
            secondaryColor: true,
            tagline: true,
            description: true,
            metaTitle: true,
            metaDescription: true,
            metaKeywords: true,
            isActive: true
          }
        }
      }
    });
  },
  findTenantByDomainOrEmail: async (domain, email) => {
    return prisma.tenant.findFirst({
      where: {
        OR: [
          { domain },
          { email }
        ]
      }
    });
  },
};

module.exports = tenantRepository;