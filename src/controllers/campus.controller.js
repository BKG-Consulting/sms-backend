const { createCampus: createCampusService, getCampusesByTenantService } = require('../services/campus.service');
const { AppError } = require('../../errors/app.error');

const createCampus = async (req, res, next) => {
  try {
    const campus = await createCampusService({
      ...req.body,
      tenantId: req.params.id,
      createdBy: req.user.userId,
    });
    res.status(201).json({ campus });
  } catch (error) {
    next(error);
  }
};

const getCampuses = async (req, res, next) => {
  try {
    const campuses = await getCampusesByTenantService(req.user.tenantId);
    res.status(200).json({ 
      message: 'Campuses retrieved successfully',
      campuses,
      count: campuses.length
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { createCampus, getCampuses };