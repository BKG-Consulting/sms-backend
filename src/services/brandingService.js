const { prisma } = require('../../prisma/client');

/**
 * Get branding information for a tenant
 */
async function getTenantBranding(tenantId) {
  try {
    const branding = await prisma.tenantBranding.findUnique({
      where: { tenantId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
            type: true,
            logoUrl: true, // Legacy field for backward compatibility
          }
        }
      }
    });

    if (!branding) {
      // Return default branding if none exists
      return {
        tenantId,
        logoUrl: null,
        faviconUrl: null,
        primaryColor: '#00A79D',
        secondaryColor: '#EF8201',
        tagline: '',
        description: '',
        metaTitle: '',
        metaDescription: '',
        metaKeywords: '',
        isActive: true
      };
    }

    return branding;
  } catch (error) {
    console.error('Error fetching tenant branding:', error);
    throw new Error('Failed to fetch tenant branding');
  }
}

/**
 * Create or update branding for a tenant
 */
async function updateBrandingForTenant(tenantId, brandingData) {
  try {
    const {
      logoUrl,
      faviconUrl,
      primaryColor,
      secondaryColor,
      tagline,
      description,
      metaTitle,
      metaDescription,
      metaKeywords,
      isActive = true
    } = brandingData;

    // Upsert branding record
    const branding = await prisma.tenantBranding.upsert({
      where: { tenantId },
      update: {
        logoUrl,
        faviconUrl,
        primaryColor,
        secondaryColor,
        tagline,
        description,
        metaTitle,
        metaDescription,
        metaKeywords,
        isActive,
        updatedAt: new Date()
      },
      create: {
        tenantId,
        logoUrl,
        faviconUrl,
        primaryColor: primaryColor || '#00A79D',
        secondaryColor: secondaryColor || '#EF8201',
        tagline,
        description,
        metaTitle,
        metaDescription,
        metaKeywords,
        isActive
      }
    });

    // Also update the legacy logoUrl field in Tenant for backward compatibility
    if (logoUrl) {
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { logoUrl }
      });
    }

    return branding;
  } catch (error) {
    console.error('Error updating tenant branding:', error);
    throw new Error('Failed to update tenant branding');
  }
}

/**
 * Compose comprehensive branding information for a tenant
 */
async function composeTenantBrandingInfo(tenantId) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        branding: true
      }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Use branding data if available, fallback to tenant defaults
    const branding = tenant.branding || {};
    
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantDomain: tenant.domain,
      tenantType: tenant.type,
      
      // Branding assets
      logoUrl: branding.logoUrl || tenant.logoUrl || null,
      faviconUrl: branding.faviconUrl || null,
      
      // Colors
      primaryColor: branding.primaryColor || '#00A79D',
      secondaryColor: branding.secondaryColor || '#EF8201',
      
      // Content
      tagline: branding.tagline || '',
      description: branding.description || '',
      
      // SEO
      metaTitle: branding.metaTitle || tenant.name,
      metaDescription: branding.metaDescription || '',
      metaKeywords: branding.metaKeywords || '',
      
      // Status
      isActive: branding.isActive !== false,
      
      // Legacy support
      legacyLogoUrl: tenant.logoUrl
    };
  } catch (error) {
    console.error('Error composing tenant branding info:', error);
    throw new Error('Failed to compose tenant branding information');
  }
}

/**
 * Initialize branding for a new tenant
 */
async function initializeBrandingForTenant(tenantId, initialData = {}) {
  try {
    const defaultBranding = {
      tenantId,
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#00A79D',
      secondaryColor: '#EF8201',
      tagline: '',
      description: '',
      metaTitle: '',
      metaDescription: '',
      metaKeywords: '',
      isActive: true,
      ...initialData
    };

    const branding = await prisma.tenantBranding.create({
      data: defaultBranding
    });

    return branding;
  } catch (error) {
    console.error('Error initializing tenant branding:', error);
    throw new Error('Failed to initialize tenant branding');
  }
}

/**
 * Delete branding for a tenant
 */
async function deleteBrandingForTenant(tenantId) {
  try {
    await prisma.tenantBranding.delete({
      where: { tenantId }
    });
  } catch (error) {
    console.error('Error deleting tenant branding:', error);
    throw new Error('Failed to delete tenant branding');
  }
}

/**
 * Get all active branding configurations
 */
async function getAllActiveBranding() {
  try {
    const brandings = await prisma.tenantBranding.findMany({
      where: { isActive: true },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            domain: true,
            type: true
          }
        }
      }
    });

    return brandings;
  } catch (error) {
    console.error('Error fetching all active branding:', error);
    throw new Error('Failed to fetch active branding configurations');
  }
}

module.exports = {
  getTenantBranding,
  updateBrandingForTenant,
  composeTenantBrandingInfo,
  initializeBrandingForTenant,
  deleteBrandingForTenant,
  getAllActiveBranding
}; 