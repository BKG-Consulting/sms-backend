/**
 * Agenda Template Controller
 * Handles CRUD operations for agenda templates
 */

const agendaTemplateService = require('../services/agendaTemplateService');

/**
 * Get agenda template by type
 */
const getAgendaTemplate = async (req, res, next) => {
  try {
    const { type } = req.params;
    const tenantId = req.user.tenantId;

    const template = await agendaTemplateService.getAgendaTemplate(type, tenantId);
    
    res.status(200).json({ 
      message: 'Agenda template retrieved successfully', 
      template 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all agenda templates for tenant
 */
const getAllTemplates = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    const templates = await agendaTemplateService.getAllTemplates(tenantId);
    
    res.status(200).json({ 
      message: 'Agenda templates retrieved successfully', 
      templates 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create or update agenda template
 */
const upsertTemplate = async (req, res, next) => {
  try {
    const { type } = req.params;
    const { name, items } = req.body;
    const tenantId = req.user.tenantId;

    const template = await agendaTemplateService.upsertAgendaTemplate(type, tenantId, name, items);
    
    res.status(200).json({ 
      message: 'Agenda template updated successfully', 
      template 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Initialize default templates for tenant
 */
const initializeDefaultTemplates = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    const templates = await agendaTemplateService.initializeDefaultTemplates(tenantId);
    
    res.status(200).json({ 
      message: 'Default agenda templates initialized successfully', 
      templates 
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete agenda template
 */
const deleteTemplate = async (req, res, next) => {
  try {
    const { templateId } = req.params;

    const template = await agendaTemplateService.deleteTemplate(templateId);
    
    res.status(200).json({ 
      message: 'Agenda template deleted successfully', 
      template 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAgendaTemplate,
  getAllTemplates,
  upsertTemplate,
  initializeDefaultTemplates,
  deleteTemplate
}; 