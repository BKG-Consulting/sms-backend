/**
 * Agenda Template Service
 * Manages predefined agendas for different meeting types
 */

const { prisma } = require('../../prisma/client');
const { AppError } = require('../../errors/app.error');
const { logger } = require('../utils/logger');



class AgendaTemplateService {
  /**
   * Get agenda template by type and tenant
   * @param {string} type - Meeting type (OPENING, CLOSING, etc.)
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Agenda template with items
   */
  async getAgendaTemplate(type, tenantId) {
    try {
      const template = await prisma.agendaTemplate.findFirst({
        where: {
          type,
          tenantId,
          isActive: true
        },
        include: {
          items: {
            orderBy: {
              order: 'asc'
            }
          }
        }
      });

      return template;
    } catch (error) {
      logger.error('Error getting agenda template:', error);
      throw new AppError('Failed to get agenda template', 500);
    }
  }

  /**
   * Create or update agenda template
   * @param {string} type - Meeting type
   * @param {string} tenantId - Tenant ID
   * @param {string} name - Template name
   * @param {Array} items - Agenda items
   * @returns {Object} Created/updated template
   */
  async upsertAgendaTemplate(type, tenantId, name, items) {
    try {
      // Check if template exists
      const existingTemplate = await prisma.agendaTemplate.findFirst({
        where: {
          type,
          tenantId,
          isActive: true
        }
      });

      if (existingTemplate) {
        // Update existing template
        await prisma.agendaTemplateItem.deleteMany({
          where: {
            templateId: existingTemplate.id
          }
        });

        const updatedTemplate = await prisma.agendaTemplate.update({
          where: { id: existingTemplate.id },
          data: {
            name,
            items: {
              create: items.map((item, index) => ({
                agendaText: item.agendaText,
                order: index + 1,
                isRequired: item.isRequired !== false
              }))
            }
          },
          include: {
            items: {
              orderBy: {
                order: 'asc'
              }
            }
          }
        });

        return updatedTemplate;
      } else {
        // Create new template
        const newTemplate = await prisma.agendaTemplate.create({
          data: {
            type,
            tenantId,
            name,
            items: {
              create: items.map((item, index) => ({
                agendaText: item.agendaText,
                order: index + 1,
                isRequired: item.isRequired !== false
              }))
            }
          },
          include: {
            items: {
              orderBy: {
                order: 'asc'
              }
            }
          }
        });

        return newTemplate;
      }
    } catch (error) {
      logger.error('Error upserting agenda template:', error);
      throw new AppError('Failed to upsert agenda template', 500);
    }
  }

  /**
   * Initialize default agenda templates for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Object} Created templates
   */
  async initializeDefaultTemplates(tenantId) {
    try {
      const defaultTemplates = {
        OPENING: {
          name: 'Opening Meeting Agendas',
          items: [
            { agendaText: 'Introduction and registration', isRequired: true },
            { agendaText: 'Confirmation of Audit Objectives, Scope & Criteria', isRequired: true },
            { agendaText: 'Confirmation of the Audit plan', isRequired: true },
            { agendaText: 'Methods and procedures to be used to conduct the audit', isRequired: true },
            { agendaText: 'Confirmation of the formal Communication channels', isRequired: true },
            { agendaText: 'Confirmation of language to be used during the audit', isRequired: true },
            { agendaText: 'Confirmation that during the audit, the auditee shall be kept informed of Progress', isRequired: true },
            { agendaText: 'Confirmation of Resources required', isRequired: true },
            { agendaText: 'Confirmation of matters relating to Confidentiality', isRequired: true },
            { agendaText: 'Confirmation of the relevant work safety, emergency and Safety of the Auditors', isRequired: true },
            { agendaText: 'Confirmation of the Availability of guides ,including stating their roles and responsibilities', isRequired: true },
            { agendaText: 'Method of Reporting of the findings including grading of non conformities', isRequired: true },
            { agendaText: 'Conditions under which an audit may be terminated', isRequired: true }
          ]
        },
        CLOSING: {
          name: 'Closing Meeting Agendas',
          items: [
            { agendaText: 'Introduction and registration', isRequired: true },
            { agendaText: 'Confirmation of audit objectives, scope and criteria', isRequired: true },
            { agendaText: 'Presentation of audit findings', isRequired: true },
            { agendaText: 'Discussion of non-conformities and observations', isRequired: true },
            { agendaText: 'Agreement on corrective actions and timelines', isRequired: true },
            { agendaText: 'Confirmation of audit conclusions', isRequired: true },
            { agendaText: 'Discussion of audit report format and distribution', isRequired: true },
            { agendaText: 'Any other business', isRequired: false },
            { agendaText: 'Closing remarks', isRequired: true }
          ]
        }
      };

      const results = {};
      
      for (const [type, template] of Object.entries(defaultTemplates)) {
        results[type] = await this.upsertAgendaTemplate(type, tenantId, template.name, template.items);
      }

      return results;
    } catch (error) {
      logger.error('Error initializing default templates:', error);
      throw new AppError('Failed to initialize default templates', 500);
    }
  }

  /**
   * Get all agenda templates for a tenant
   * @param {string} tenantId - Tenant ID
   * @returns {Array} All templates
   */
  async getAllTemplates(tenantId) {
    try {
      const templates = await prisma.agendaTemplate.findMany({
        where: {
          tenantId,
          isActive: true
        },
        include: {
          items: {
            orderBy: {
              order: 'asc'
            }
          }
        },
        orderBy: {
          type: 'asc'
        }
      });

      return templates;
    } catch (error) {
      logger.error('Error getting all templates:', error);
      throw new AppError('Failed to get templates', 500);
    }
  }

  /**
   * Delete agenda template
   * @param {string} templateId - Template ID
   * @returns {Object} Deleted template
   */
  async deleteTemplate(templateId) {
    try {
      const template = await prisma.agendaTemplate.update({
        where: { id: templateId },
        data: { isActive: false }
      });

      return template;
    } catch (error) {
      logger.error('Error deleting template:', error);
      throw new AppError('Failed to delete template', 500);
    }
  }
}

module.exports = new AgendaTemplateService(); 