const { prisma } = require('../../prisma/client');
const { createCampus: createCampusRepo, getCampusesByTenant } = require('../repositories/campus.repository'); // Rename import to avoid conflict
const { findTenantById } = require('../repositories/tenantRepository');
const { logger } = require('../utils/logger.util');
const { AppError } = require('../../errors/app.error');

// Rename this function to avoid redeclaration conflict
const createCampus = async ({ name, address, city, county, country, phone, email, isMain, tenantId, createdBy }) => {
  if (!name || !tenantId) {
    throw new AppError('Missing required fields: name, tenantId', 400);
  }

  try {
    const tenant = await findTenantById(tenantId);
    if (!tenant) throw new AppError('Tenant not found', 404);

    // Use the renamed repository function
    const campus = await createCampusRepo({
      name,
      address,
      city,
      county,
      country: country || 'Kenya',
      phone,
      email,
      isMain: isMain || false,
      tenantId,
      createdBy,
    });

    return campus;
  } catch (error) {
    logger.error('Error creating campus:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getCampusesByTenantService = async (tenantId) => {
  if (!tenantId) {
    throw new AppError('Missing required field: tenantId', 400);
  }

  try {
    const tenant = await findTenantById(tenantId);
    if (!tenant) throw new AppError('Tenant not found', 404);

    const campuses = await getCampusesByTenant(tenantId);
    return campuses;
  } catch (error) {
    logger.error('Error fetching campuses:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

module.exports = { createCampus, getCampusesByTenantService };