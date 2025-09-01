const s3 = require('../config/s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

/**
 * Storage service for handling file uploads
 * Supports logos, favicons, and other branding assets
 * Uses the same S3 configuration as document uploads
 */
class StorageService {
  /**
   * Upload a file to S3 and return the URL
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} folder - S3 folder (e.g., 'logos', 'favicons')
   * @param {string} tenantId - Tenant ID for organization
   * @returns {Promise<{url: string, s3Key: string}>}
   */
  async uploadFile(fileBuffer, originalName, mimeType, folder, tenantId) {
    try {
      // Generate unique filename following the same pattern as document uploads
      const fileExtension = path.extname(originalName);
      const fileName = `${Date.now()}_${uuidv4()}${fileExtension}`;
      const s3Key = `tenants/${tenantId}/${folder}/${fileName}`;
      
      // Use the same S3 upload pattern as document uploads
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: mimeType,
      };
      
      const uploadResult = await s3.upload(params).promise();
      const fileUrl = uploadResult.Location;
      
      return {
        url: fileUrl,
        s3Key: s3Key
      };
    } catch (error) {
      console.error('Storage service upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload logo for a tenant
   * @param {Buffer} fileBuffer - Logo file buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<{url: string, s3Key: string}>}
   */
  async uploadLogo(fileBuffer, originalName, mimeType, tenantId) {
    return this.uploadFile(fileBuffer, originalName, mimeType, 'logos', tenantId);
  }

  /**
   * Upload favicon for a tenant
   * @param {Buffer} fileBuffer - Favicon file buffer
   * @param {string} originalName - Original filename
   * @param {string} mimeType - File MIME type
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<{url: string, s3Key: string}>}
   */
  async uploadFavicon(fileBuffer, originalName, mimeType, tenantId) {
    return this.uploadFile(fileBuffer, originalName, mimeType, 'favicons', tenantId);
  }

  /**
   * Delete a file from S3 using the same pattern as document service
   * @param {string} s3Key - S3 key of the file to delete
   * @returns {Promise<void>}
   */
  async deleteFile(s3Key) {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
      };
      
      await s3.deleteObject(params).promise();
    } catch (error) {
      console.error('Storage service delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Generate a pre-signed URL for secure access (similar to document service)
   * @param {string} s3Key - S3 key of the file
   * @param {number} expiresIn - Expiration time in seconds (default: 5 minutes)
   * @returns {Promise<string>}
   */
  async getSignedUrl(s3Key, expiresIn = 300) {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
        Expires: expiresIn,
      };
      
      return s3.getSignedUrl('getObject', params);
    } catch (error) {
      console.error('Storage service signed URL error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Validate file type and size
   * @param {string} mimeType - File MIME type
   * @param {number} fileSize - File size in bytes
   * @param {string} fileType - Type of file ('logo' or 'favicon')
   * @returns {boolean}
   */
  validateFile(mimeType, fileSize, fileType = 'logo') {
    const maxSizes = {
      logo: 5 * 1024 * 1024, // 5MB for logos
      favicon: 1 * 1024 * 1024 // 1MB for favicons
    };

    const allowedTypes = {
      logo: ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'],
      favicon: ['image/x-icon', 'image/png', 'image/svg+xml']
    };

    const maxSize = maxSizes[fileType];
    const allowedMimeTypes = allowedTypes[fileType];

    if (!allowedMimeTypes.includes(mimeType)) {
      throw new Error(`Invalid file type. Allowed types for ${fileType}: ${allowedMimeTypes.join(', ')}`);
    }

    if (fileSize > maxSize) {
      throw new Error(`File too large. Maximum size for ${fileType}: ${maxSize / (1024 * 1024)}MB`);
    }

    return true;
  }

  /**
   * Generate different sizes of logo for responsive design
   * @param {Buffer} fileBuffer - Original logo buffer
   * @param {string} mimeType - File MIME type
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<{original: {url: string, s3Key: string}, thumbnail: {url: string, s3Key: string}}>}
   */
  async uploadLogoWithThumbnail(fileBuffer, originalName, mimeType, tenantId) {
    try {
      // Upload original logo
      const original = await this.uploadLogo(fileBuffer, originalName, mimeType, tenantId);
      
      // TODO: Generate thumbnail if needed
      // For now, return the same URL for both
      return {
        original,
        thumbnail: original
      };
    } catch (error) {
      console.error('Logo upload with thumbnail error:', error);
      throw error;
    }
  }

  /**
   * List all branding files for a tenant (for management purposes)
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Array>}
   */
  async listBrandingFiles(tenantId) {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Prefix: `tenants/${tenantId}/`,
      };
      
      const result = await s3.listObjectsV2(params).promise();
      
      return result.Contents?.map(item => ({
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        type: item.Key.includes('/logos/') ? 'logo' : 
              item.Key.includes('/favicons/') ? 'favicon' : 'other'
      })) || [];
    } catch (error) {
      console.error('Storage service list files error:', error);
      throw new Error(`Failed to list branding files: ${error.message}`);
    }
  }

  /**
   * Check if a file exists in S3
   * @param {string} s3Key - S3 key of the file
   * @returns {Promise<boolean>}
   */
  async fileExists(s3Key) {
    try {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: s3Key,
      };
      
      await s3.headObject(params).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}

module.exports = new StorageService(); 