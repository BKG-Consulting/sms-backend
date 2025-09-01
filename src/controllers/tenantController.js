// src/controllers/tenantController.js
const { z } = require('zod');
const { onboardTenantWithAdmin } = require('../services/tenantOnboardingService');
const { logger } = require('../utils/logger');
const tenantService = require('../services/tenantService');
const brandingService = require('../services/brandingService'); // New: dedicated branding service

// Helper functions for tenant branding defaults
function getTenantTagline(type) {
  const taglines = {
    'UNIVERSITY': 'Excellence in Higher Education',
    'COLLEGE': 'Quality Education for Tomorrow',
    'SCHOOL': 'Building Future Leaders',
    'INSTITUTE': 'Professional Development Excellence',
    'OTHER': 'Quality Management Excellence'
  };
  return taglines[type] || 'Quality Management Excellence';
}

function getTenantDescription(type) {
  const descriptions = {
    'UNIVERSITY': 'Leading university committed to academic excellence and quality management systems.',
    'COLLEGE': 'Premier college offering quality education and professional development.',
    'SCHOOL': 'Excellence in education with focus on quality and continuous improvement.',
    'INSTITUTE': 'Professional institute dedicated to quality management and standards.',
    'OTHER': 'Organization committed to quality management and operational excellence.'
  };
  return descriptions[type] || 'Organization committed to quality management and operational excellence.';
}

const tenantOnboardingSchema = z.object({
  tenant: z.object({
    name: z.string().min(1),
    domain: z.string().min(1),
    email: z.string().email(),
    type: z.string().min(1),
    logoUrl: z.string().optional(),
    phone: z.string().optional(),
    accreditationNumber: z.string().optional(),
    establishedYear: z.union([z.string(), z.number()]).optional(),
    timezone: z.string().optional(),
    currency: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    county: z.string().optional(),
    country: z.string().optional(),
    // Enhanced branding fields (optional until migration is run)
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    tagline: z.string().optional(),
    description: z.string().optional(),
    website: z.string().optional(),
    postalCode: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    metaKeywords: z.string().optional(),
    contactPerson: z.string().optional(),
    contactEmail: z.string().optional(),
    contactPhone: z.string().optional(),
    legalName: z.string().optional(),
    registrationNumber: z.string().optional(),
    taxId: z.string().optional(),
    subscriptionPlan: z.string().optional(),
    maxUsers: z.union([z.string(), z.number()]).optional(),
    maxStorageGB: z.union([z.string(), z.number()]).optional(),
  }),
  adminUser: z.object({
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    password: z.string().min(6),
  })
});

// Validation schema for branding updates
const brandingUpdateSchema = z.object({
  logoUrl: z.string().url().optional().nullable(),
  faviconUrl: z.string().url().optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  tagline: z.string().optional(),
  description: z.string().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  metaKeywords: z.string().optional(),
  isActive: z.boolean().optional()
});

const userRegistrationSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(6),
  departmentRoles: z.array(z.object({
    departmentId: z.string(),
    roleId: z.string(),
    isPrimaryDepartment: z.boolean().optional(),
    isPrimaryRole: z.boolean().optional(),
  })).optional(),
  roleIds: z.array(z.string()).optional(),
});

const userUpdateSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  departmentRoles: z.array(z.object({
    departmentId: z.string(),
    roleId: z.string(),
    isPrimaryDepartment: z.boolean().optional(),
    isPrimaryRole: z.boolean().optional(),
  })).optional(),
  roleIds: z.array(z.string()).optional(),
  verified: z.boolean().optional(),
  defaultRole: z.object({
    id: z.string(),
    type: z.enum(['userRole', 'userDepartmentRole'])
  }).optional(),
});

const tenantSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
  email: z.string().email(),
  type: z.enum(['UNIVERSITY', 'COLLEGE', 'SCHOOL', 'INSTITUTE', 'OTHER']),
  logoUrl: z.string().optional(),
  phone: z.string().optional(),
  accreditationNumber: z.string().optional(),
  establishedYear: z.number().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
});

const tenantController = {
  // Public method to get tenant by domain (for frontend tenant detection)
  getTenantByDomain: async (req, res, next) => {
    try {
      const { domain } = req.params;
      if (!domain) {
        return res.status(400).json({ 
          message: 'Domain parameter is required',
          error: 'Missing domain'
        });
      }
      // Delegate to service, which handles all business logic and data shaping
      const tenantInfo = await tenantService.getTenantInfoByDomain(domain);
      if (!tenantInfo) {
        return res.status(404).json({ 
          message: 'Tenant not found',
          error: 'Tenant not found'
        });
      }
      logger.info('Tenant fetched by domain', { domain, tenantId: tenantInfo.id });
      res.json(tenantInfo);
    } catch (error) {
      next(error);
    }
  },

  getAllTenants: async (req, res, next) => {
    try {
      const { page = 1, limit = 10, search } = req.query;
      const offset = (page - 1) * limit;
      
      const result = await tenantService.getTenantsWithStats({ 
        page: parseInt(page), 
        limit: parseInt(limit), 
        offset,
        search 
      });
      
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  createTenant: async (req, res, next) => {
    try {
      const createdBy = req.user?.userId || 'system';
      const payload = tenantOnboardingSchema.parse(req.body);
      // Delegate to onboarding service
      const result = await tenantService.createTenantWithAdmin({ ...payload, createdBy });
      logger.info('Tenant created successfully', { 
        tenantId: result.tenant.id, 
        domain: result.tenant.domain,
        createdBy 
      });
      res.status(201).json({ 
        message: 'Tenant created successfully', 
        tenant: result.tenant,
        adminUser: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        }
      });
    } catch (error) {
      if (error.code === 'P2002' && error.meta && error.meta.target) {
        const field = error.meta.target[0];
        return res.status(400).json({ 
          message: `A tenant with this ${field} already exists.`,
          error: 'Duplicate field'
        });
      }
      next(error);
    }
  },

  getTenantById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const tenant = await tenantService.getTenantById(id);
      if (!tenant) {
        return res.status(404).json({ 
          message: 'Tenant not found',
          error: 'Tenant not found'
        });
      }
      res.status(200).json({ tenant });
    } catch (error) {
      next(error);
    }
  },

  updateTenant: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const updateData = tenantService.parseTenantUpdate(req.body); // Move schema to service
      const updatedTenant = await tenantService.updateTenant(tenantId, updateData);
      res.status(200).json({ message: 'Tenant updated successfully', tenant: updatedTenant });
    } catch (error) {
      next(error);
    }
  },

  updateTenantBranding: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const brandingData = req.body;

      // Validate the request body
      const validatedData = brandingUpdateSchema.parse(brandingData);

      // Update branding for the tenant
      const updatedBranding = await brandingService.updateBrandingForTenant(tenantId, validatedData);

      logger.info('Tenant branding updated successfully', {
        tenantId,
        updatedBy: req.user?.userId,
        brandingId: updatedBranding.id
      });

      res.status(200).json({
        success: true,
        message: 'Tenant branding updated successfully',
        data: {
          branding: {
            id: updatedBranding.id,
            logoUrl: updatedBranding.logoUrl,
            faviconUrl: updatedBranding.faviconUrl,
            primaryColor: updatedBranding.primaryColor,
            secondaryColor: updatedBranding.secondaryColor,
            tagline: updatedBranding.tagline,
            description: updatedBranding.description,
            metaTitle: updatedBranding.metaTitle,
            metaDescription: updatedBranding.metaDescription,
            metaKeywords: updatedBranding.metaKeywords,
            isActive: updatedBranding.isActive,
            updatedAt: updatedBranding.updatedAt
          }
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid branding data',
          errors: error.errors
        });
      }
      next(error);
    }
  },

  suspendTenant: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const updatedTenant = await tenantService.suspendTenant(tenantId);
      res.status(200).json({ message: 'Tenant suspended successfully', tenant: updatedTenant });
    } catch (error) {
      next(error);
    }
  },

  deleteTenant: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const deletedTenant = await tenantService.deleteTenant(tenantId);
      res.status(200).json({ message: 'Tenant deleted successfully', tenant: deletedTenant });
    } catch (error) {
      next(error);
    }
  },

  getInstitutionDetails: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const details = await tenantService.getInstitutionDetails(tenantId);
      res.status(200).json({ details });
    } catch (error) {
      next(error);
    }
  },
  registerUser: async (req, res, next) => {
    try {
      const tenantId = req.user.tenantId; // Extract tenantId from authenticated user
      const createdBy = req.user?.userId || 'system';
      const userData = userRegistrationSchema.parse(req.body);
      if (!tenantId) {
        return res.status(400).json({ 
          message: 'Tenant ID not found in user context',
          error: 'Missing tenant context'
        });
      }
      const user = await tenantService.registerUserWithRolesAndDepartment({
        ...userData,
        tenantId,
        createdBy,
      });
      res.status(201).json({ message: 'User registered successfully', user: { ...user, isActive: user.verified } });
    } catch (error) {
      if (error.code === 'P2002' && error.meta && error.meta.target && error.meta.target.includes('email')) {
        return res.status(400).json({ message: 'A user with this email already exists.' });
      }
      next(error);
    }
  },
  updateUser: async (req, res, next) => {
    try {
      const { tenantId, userId } = req.params;
      const updatedBy = req.user?.userId || 'system';
      const updateData = userUpdateSchema.parse(req.body);
      if (req.user.tenantId !== tenantId) {
        return res.status(403).json({ 
          message: 'Access denied: You can only manage users in your own tenant',
          error: 'Tenant mismatch'
        });
      }
      const updatedUser = await tenantService.updateUserWithRolesAndDepartment({
        userId,
        tenantId,
        updateData,
        updatedBy,
        defaultRole: updateData.defaultRole,
      });
      res.status(200).json({ 
        message: 'User updated successfully', 
        data: { ...updatedUser, isActive: updatedUser.verified } 
      });
    } catch (error) {
      if (error.code === 'P2002' && error.meta && error.meta.target && error.meta.target.includes('email')) {
        return res.status(400).json({ message: 'A user with this email already exists.' });
      }
      next(error);
    }
  },
  deleteUser: async (req, res, next) => {
    try {
      const { tenantId, userId } = req.params;
      const deletedBy = req.user?.userId || 'system';
      if (req.user.tenantId !== tenantId) {
        return res.status(403).json({ 
          message: 'Access denied: You can only manage users in your own tenant',
          error: 'Tenant mismatch'
        });
      }
      if (req.user.userId === userId) {
        return res.status(400).json({ 
          message: 'You cannot delete your own account',
          error: 'Self-deletion not allowed'
        });
      }
      await tenantService.deleteUserFromTenant({
        userId,
        tenantId,
        deletedBy,
      });
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      next(error);
    }
  },

  getTenantsWithStats: async (req, res, next) => {
    try {
      const { page = 1, limit = 10, search } = req.query;
      const tenants = await tenantService.getTenantsWithStats({ 
        page: parseInt(page), 
        limit: parseInt(limit), 
        search 
      });
      res.status(200).json({ success: true, data: tenants });
    } catch (error) {
      next(error);
    }
  },

  getTenantAnalytics: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const analytics = await tenantService.getTenantAnalytics(tenantId);
      res.status(200).json({ success: true, data: analytics });
    } catch (error) {
      next(error);
    }
  },

  getTenantDistribution: async (req, res, next) => {
    try {
      const distribution = await tenantService.getTenantDistributionByCounty();
      res.status(200).json({ success: true, data: distribution });
    } catch (error) {
      next(error);
    }
  },

  getUsersForTenant: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const users = await tenantService.getUsersForTenant(tenantId);
      
      // Prevent caching to ensure fresh data
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.status(200).json({ users });
    } catch (error) {
      next(error);
    }
  },

  // Fix SYSTEM_ADMIN permissions for existing tenants
  fixSystemAdminPermissions: async (req, res, next) => {
    try {
      if (!req.user.roles?.some(role => role.name === 'SUPER_ADMIN')) {
        return res.status(403).json({ 
          message: 'Only super admins can run this migration',
          error: 'Insufficient permissions'
        });
      }
      const { fixSystemAdminPermissions } = require('../../scripts/fix-system-admin-permissions');
      await fixSystemAdminPermissions();
      res.status(200).json({ 
        message: 'SYSTEM_ADMIN permissions migration completed successfully',
        success: true
      });
    } catch (error) {
      next(error);
    }
  },

  // Fix SYSTEM_ADMIN login destinations for existing tenants
  fixSystemAdminLoginDestinations: async (req, res, next) => {
    try {
      if (!req.user.roles?.some(role => role.name === 'SUPER_ADMIN')) {
        return res.status(403).json({ 
          message: 'Only super admins can run this migration',
          error: 'Insufficient permissions'
        });
      }
      const { fixSystemAdminLoginDestinations } = require('../../scripts/fix-system-admin-login-destinations');
      await fixSystemAdminLoginDestinations();
      res.status(200).json({ 
        message: 'SYSTEM_ADMIN loginDestination migration completed successfully',
        success: true
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = tenantController;