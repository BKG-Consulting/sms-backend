const storageService = require('../services/storageService');
const { logger } = require('../utils/logger');

const uploadController = {
  /**
   * Upload logo for a tenant
   */
  uploadLogo: async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No logo file provided'
        });
      }

      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required'
        });
      }

      // Validate file
      storageService.validateFile(
        req.file.mimetype, 
        req.file.size, 
        'logo'
      );

      // Upload to S3 using the same pattern as document uploads
      const result = await storageService.uploadLogo(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        tenantId
      );

      logger.info('Logo uploaded successfully', {
        tenantId,
        uploadedBy: req.user?.userId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        s3Key: result.s3Key
      });

      res.status(200).json({
        success: true,
        message: 'Logo uploaded successfully',
        data: {
          url: result.url,
          s3Key: result.s3Key,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype
        }
      });

    } catch (error) {
      logger.error('Logo upload failed', {
        error: error.message,
        tenantId: req.body.tenantId,
        uploadedBy: req.user?.userId
      });
      next(error);
    }
  },

  /**
   * Upload favicon for a tenant
   */
  uploadFavicon: async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No favicon file provided'
        });
      }

      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required'
        });
      }

      // Validate file
      storageService.validateFile(
        req.file.mimetype, 
        req.file.size, 
        'favicon'
      );

      // Upload to S3 using the same pattern as document uploads
      const result = await storageService.uploadFavicon(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        tenantId
      );

      logger.info('Favicon uploaded successfully', {
        tenantId,
        uploadedBy: req.user?.userId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        s3Key: result.s3Key
      });

      res.status(200).json({
        success: true,
        message: 'Favicon uploaded successfully',
        data: {
          url: result.url,
          s3Key: result.s3Key,
          fileName: req.file.originalname,
          fileSize: req.file.size,
          mimeType: req.file.mimetype
        }
      });

    } catch (error) {
      logger.error('Favicon upload failed', {
        error: error.message,
        tenantId: req.body.tenantId,
        uploadedBy: req.user?.userId
      });
      next(error);
    }
  },

  /**
   * Upload multiple branding assets (logo and favicon)
   */
  uploadBrandingAssets: async (req, res, next) => {
    try {
      const { tenantId } = req.body;
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant ID is required'
        });
      }

      const results = {};

      // Upload logo if provided
      if (req.files.logo && req.files.logo[0]) {
        const logoFile = req.files.logo[0];
        storageService.validateFile(logoFile.mimetype, logoFile.size, 'logo');
        
        const logoResult = await storageService.uploadLogo(
          logoFile.buffer,
          logoFile.originalname,
          logoFile.mimetype,
          tenantId
        );
        
        results.logo = {
          url: logoResult.url,
          s3Key: logoResult.s3Key,
          fileName: logoFile.originalname,
          fileSize: logoFile.size,
          mimeType: logoFile.mimetype
        };
      }

      // Upload favicon if provided
      if (req.files.favicon && req.files.favicon[0]) {
        const faviconFile = req.files.favicon[0];
        storageService.validateFile(faviconFile.mimetype, faviconFile.size, 'favicon');
        
        const faviconResult = await storageService.uploadFavicon(
          faviconFile.buffer,
          faviconFile.originalname,
          faviconFile.mimetype,
          tenantId
        );
        
        results.favicon = {
          url: faviconResult.url,
          s3Key: faviconResult.s3Key,
          fileName: faviconFile.originalname,
          fileSize: faviconFile.size,
          mimeType: faviconFile.mimetype
        };
      }

      logger.info('Branding assets uploaded successfully', {
        tenantId,
        uploadedBy: req.user?.userId,
        uploadedFiles: Object.keys(results),
        s3Keys: Object.values(results).map(r => r.s3Key)
      });

      res.status(200).json({
        success: true,
        message: 'Branding assets uploaded successfully',
        data: results
      });

    } catch (error) {
      logger.error('Branding assets upload failed', {
        error: error.message,
        tenantId: req.body.tenantId,
        uploadedBy: req.user?.userId
      });
      next(error);
    }
  },

  /**
   * Delete logo
   */
  deleteLogo: async (req, res, next) => {
    try {
      const { s3Key } = req.params;
      
      // Check if file exists before deleting
      const exists = await storageService.fileExists(s3Key);
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: 'Logo file not found'
        });
      }
      
      await storageService.deleteFile(s3Key);

      logger.info('Logo deleted successfully', {
        s3Key,
        deletedBy: req.user?.userId
      });

      res.status(200).json({
        success: true,
        message: 'Logo deleted successfully'
      });

    } catch (error) {
      logger.error('Logo deletion failed', {
        error: error.message,
        s3Key: req.params.s3Key,
        deletedBy: req.user?.userId
      });
      next(error);
    }
  },

  /**
   * Delete favicon
   */
  deleteFavicon: async (req, res, next) => {
    try {
      const { s3Key } = req.params;
      
      // Check if file exists before deleting
      const exists = await storageService.fileExists(s3Key);
      if (!exists) {
        return res.status(404).json({
          success: false,
          message: 'Favicon file not found'
        });
      }
      
      await storageService.deleteFile(s3Key);

      logger.info('Favicon deleted successfully', {
        s3Key,
        deletedBy: req.user?.userId
      });

      res.status(200).json({
        success: true,
        message: 'Favicon deleted successfully'
      });

    } catch (error) {
      logger.error('Favicon deletion failed', {
        error: error.message,
        s3Key: req.params.s3Key,
        deletedBy: req.user?.userId
      });
      next(error);
    }
  },

  /**
   * List branding files for a tenant (for management purposes)
   */
  listBrandingFiles: async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      
      const files = await storageService.listBrandingFiles(tenantId);

      res.status(200).json({
        success: true,
        message: 'Branding files retrieved successfully',
        data: {
          files,
          count: files.length
        }
      });

    } catch (error) {
      logger.error('List branding files failed', {
        error: error.message,
        tenantId: req.params.tenantId,
        requestedBy: req.user?.userId
      });
      next(error);
    }
  },

  /**
   * Get signed URL for secure access to branding files
   */
  getSignedUrl: async (req, res, next) => {
    try {
      const { s3Key } = req.params;
      const { expiresIn = 300 } = req.query; // Default 5 minutes
      
      const signedUrl = await storageService.getSignedUrl(s3Key, parseInt(expiresIn));

      res.status(200).json({
        success: true,
        message: 'Signed URL generated successfully',
        data: {
          url: signedUrl,
          expiresIn: parseInt(expiresIn),
          s3Key
        }
      });

    } catch (error) {
      logger.error('Signed URL generation failed', {
        error: error.message,
        s3Key: req.params.s3Key,
        requestedBy: req.user?.userId
      });
      next(error);
    }
  }
};

module.exports = uploadController; 