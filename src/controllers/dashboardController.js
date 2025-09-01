const dashboardService = require('../services/dashboardService');
const { logger } = require('../utils/logger');

const dashboardController = {
  getDashboardMetrics: async (req, res) => {
    try {
      logger.info('Dashboard metrics request received');
      const metrics = await dashboardService.getDashboardMetrics();
      
      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error in getDashboardMetrics controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard metrics',
        error: error.message
      });
    }
  },

  getTenantDetails: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const tenantDetails = await dashboardService.getTenantDetails(tenantId);
      
      if (!tenantDetails) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      logger.info('Tenant details fetched successfully', { tenantId });
      res.status(200).json({
        success: true,
        data: tenantDetails
      });
    } catch (error) {
      logger.error('Error fetching tenant details:', error);
      next(error);
    }
  },

  getSystemAdminDashboard: async (req, res) => {
    try {
      const { tenantId } = req.user;
      logger.info('System admin dashboard request received for tenant:', tenantId);
      
      const metrics = await dashboardService.getSystemAdminDashboard(tenantId);
      
      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error in getSystemAdminDashboard controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system admin dashboard metrics',
        error: error.message
      });
    }
  },

  // New chart data endpoints
  getUserGrowthData: async (req, res) => {
    try {
      const { timeFrame = 'monthly' } = req.query;
      logger.info('User growth data request received for timeFrame:', timeFrame);
      
      const data = await dashboardService.getUserGrowthData(timeFrame);
      
      res.status(200).json({
        success: true,
        data: data
      });
    } catch (error) {
      logger.error('Error in getUserGrowthData controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user growth data',
        error: error.message
      });
    }
  },

  getTenantActivityData: async (req, res) => {
    try {
      const { timeFrame = 'this week' } = req.query;
      logger.info('Tenant activity data request received for timeFrame:', timeFrame);
      
      const data = await dashboardService.getTenantActivityData(timeFrame);
      
      res.status(200).json({
        success: true,
        data: data
      });
    } catch (error) {
      logger.error('Error in getTenantActivityData controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tenant activity data',
        error: error.message
      });
    }
  },

  // New system admin chart data endpoints
  getSystemAdminUserGrowthData: async (req, res) => {
    try {
      const { timeFrame = 'monthly' } = req.query;
      const { tenantId } = req.user;
      logger.info('System admin user growth data request received for tenant:', tenantId, 'timeFrame:', timeFrame);
      
      const data = await dashboardService.getSystemAdminUserGrowthData(tenantId, timeFrame);
      
      res.status(200).json({
        success: true,
        data: data
      });
    } catch (error) {
      logger.error('Error in getSystemAdminUserGrowthData controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system admin user growth data',
        error: error.message
      });
    }
  },

  getSystemAdminDepartmentActivityData: async (req, res) => {
    try {
      const { timeFrame = 'this week' } = req.query;
      const { tenantId } = req.user;
      logger.info('System admin department activity data request received for tenant:', tenantId, 'timeFrame:', timeFrame);
      
      const data = await dashboardService.getSystemAdminDepartmentActivityData(tenantId, timeFrame);
      
      res.status(200).json({
        success: true,
        data: data
      });
    } catch (error) {
      logger.error('Error in getSystemAdminDepartmentActivityData controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch system admin department activity data',
        error: error.message
      });
    }
  },

  // MR-specific dashboard endpoints
  getMRDashboard: async (req, res) => {
    try {
      const { tenantId } = req.user;
      logger.info('MR dashboard request received for tenant:', tenantId);
      
      const metrics = await dashboardService.getMRDashboard(tenantId);
      
      res.status(200).json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error in getMRDashboard controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch MR dashboard metrics',
        error: error.message
      });
    }
  },

  getMRAuditProgramGrowthData: async (req, res) => {
    try {
      const { timeFrame = 'monthly' } = req.query;
      const { tenantId } = req.user;
      logger.info('MR audit program growth data request received for tenant:', tenantId, 'timeFrame:', timeFrame);
      
      const data = await dashboardService.getMRAuditProgramGrowthData(tenantId, timeFrame);
      
      res.status(200).json({
        success: true,
        data: data
      });
    } catch (error) {
      logger.error('Error in getMRAuditProgramGrowthData controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch MR audit program growth data',
        error: error.message
      });
    }
  },

  getMRAuditActivityData: async (req, res) => {
    try {
      const { timeFrame = 'this week' } = req.query;
      const { tenantId } = req.user;
      logger.info('MR audit activity data request received for tenant:', tenantId, 'timeFrame:', timeFrame);
      
      const data = await dashboardService.getMRAuditActivityData(tenantId, timeFrame);
      
      res.status(200).json({
        success: true,
        data: data
      });
    } catch (error) {
      logger.error('Error in getMRAuditActivityData controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch MR audit activity data',
        error: error.message
      });
    }
  },

  getMRDocumentActivityData: async (req, res) => {
    try {
      const { timeFrame = 'this week' } = req.query;
      const { tenantId } = req.user;
      logger.info('MR document activity data request received for tenant:', tenantId, 'timeFrame:', timeFrame);
      
      const data = await dashboardService.getMRDocumentActivityData(tenantId, timeFrame);
      
      res.status(200).json({
        success: true,
        data: data
      });
    } catch (error) {
      logger.error('Error in getMRDocumentActivityData controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch MR document activity data',
        error: error.message
      });
    }
  },

  // Auditor Dashboard Methods
  getAuditorDashboard: async (req, res) => {
    try {
      const { tenantId, userId } = req.user;
      logger.info('Auditor dashboard request received for tenant:', tenantId, 'user:', userId);
      
      const data = await dashboardService.getAuditorDashboard(tenantId, userId);
      
      res.status(200).json({
        success: true,
        data: data
      });
    } catch (error) {
      logger.error('Error in getAuditorDashboard controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch auditor dashboard data',
        error: error.message
      });
    }
  },

  getAuditorAssignments: async (req, res) => {
    try {
      const { tenantId, userId } = req.user;
      logger.info('Auditor assignments request received for tenant:', tenantId, 'user:', userId);
      
      const assignments = await dashboardService.getAuditorAssignments(tenantId, userId);
      
      res.status(200).json({
        success: true,
        data: assignments
      });
    } catch (error) {
      logger.error('Error in getAuditorAssignments controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch auditor assignments',
        error: error.message
      });
    }
  },

  getAuditorFindings: async (req, res) => {
    try {
      const { tenantId, userId } = req.user;
      logger.info('Auditor findings request received for tenant:', tenantId, 'user:', userId);
      
      const findings = await dashboardService.getAuditorFindings(tenantId, userId);
      
      res.status(200).json({
        success: true,
        data: findings
      });
    } catch (error) {
      logger.error('Error in getAuditorFindings controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch auditor findings',
        error: error.message
      });
    }
  },

  getAuditorCorrectiveActions: async (req, res) => {
    try {
      const { tenantId, userId } = req.user;
      logger.info('Auditor corrective actions request received for tenant:', tenantId, 'user:', userId);
      
      const actions = await dashboardService.getAuditorCorrectiveActions(tenantId, userId);
      
      res.status(200).json({
        success: true,
        data: actions
      });
    } catch (error) {
      logger.error('Error in getAuditorCorrectiveActions controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch auditor corrective actions',
        error: error.message
      });
    }
  },

  getAuditorChecklists: async (req, res) => {
    try {
      const { tenantId, userId } = req.user;
      logger.info('Auditor checklists request received for tenant:', tenantId, 'user:', userId);
      
      const checklists = await dashboardService.getAuditorChecklists(tenantId, userId);
      
      res.status(200).json({
        success: true,
        data: checklists
      });
    } catch (error) {
      logger.error('Error in getAuditorChecklists controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch auditor checklists',
        error: error.message
      });
    }
  },

  getAuditorPlanningMeetings: async (req, res) => {
    try {
      const { tenantId, userId } = req.user;
      logger.info('Auditor planning meetings request received for tenant:', tenantId, 'user:', userId);
      
      const meetings = await dashboardService.getAuditorPlanningMeetings(tenantId, userId);
      
      res.status(200).json({
        success: true,
        data: meetings
      });
    } catch (error) {
      logger.error('Error in getAuditorPlanningMeetings controller:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch auditor planning meetings',
        error: error.message
      });
    }
  }
};

module.exports = dashboardController; 