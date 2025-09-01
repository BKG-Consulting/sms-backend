const path = require('path');
const fs = require('fs').promises;
const AWS = require('aws-sdk');

// Storage configuration
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local'; // 's3', 'local', or 'cloudinary'
const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || './uploads';

// Ensure local storage directory exists
async function ensureLocalStorageDir() {
  try {
    await fs.access(LOCAL_STORAGE_PATH);
  } catch (error) {
    await fs.mkdir(LOCAL_STORAGE_PATH, { recursive: true });
  }
}

// Initialize storage based on type
let s3 = null;
let cloudinaryService = null;

if (STORAGE_TYPE === 's3') {
  s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });
} else if (STORAGE_TYPE === 'cloudinary') {
  try {
    cloudinaryService = require('./cloudinary');
  } catch (error) {
    console.error('Cloudinary not available:', error.message);
  }
}

const storageService = {
  // Upload file
  async uploadFile(file, fileName) {
    if (STORAGE_TYPE === 's3') {
      return await this.uploadToS3(file, fileName);
    } else if (STORAGE_TYPE === 'cloudinary') {
      return await this.uploadToCloudinary(file, fileName);
    } else {
      return await this.uploadToLocal(file, fileName);
    }
  },

  // Upload to S3
  async uploadToS3(file, fileName) {
    if (!s3) {
      throw new Error('S3 not configured');
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const result = await s3.upload(params).promise();
    return {
      url: result.Location,
      key: fileName,
      storageType: 's3'
    };
  },

  // Upload to local storage
  async uploadToLocal(file, fileName) {
    await ensureLocalStorageDir();
    
    const filePath = path.join(LOCAL_STORAGE_PATH, fileName);
    await fs.writeFile(filePath, file.buffer);
    
    return {
      url: `/uploads/${fileName}`,
      key: fileName,
      storageType: 'local',
      localPath: filePath
    };
  },

  // Upload to Cloudinary
  async uploadToCloudinary(file, fileName) {
    if (!cloudinaryService) {
      throw new Error('Cloudinary service not available');
    }

    const result = await cloudinaryService.uploadFile(file, 'documents');
    return {
      url: result.url,
      key: result.key,
      storageType: 'cloudinary',
      cloudinaryId: result.cloudinaryId
    };
  },

  // Delete file
  async deleteFile(fileName, storageType = STORAGE_TYPE) {
    if (storageType === 's3') {
      return await this.deleteFromS3(fileName);
    } else if (storageType === 'cloudinary') {
      return await this.deleteFromCloudinary(fileName);
    } else {
      return await this.deleteFromLocal(fileName);
    }
  },

  // Delete from S3
  async deleteFromS3(fileName) {
    if (!s3) {
      throw new Error('S3 not configured');
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
    };

    await s3.deleteObject(params).promise();
    return { success: true, storageType: 's3' };
  },

  // Delete from local storage
  async deleteFromLocal(fileName) {
    const filePath = path.join(LOCAL_STORAGE_PATH, fileName);
    try {
      await fs.unlink(filePath);
      return { success: true, storageType: 'local' };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true, storageType: 'local' }; // File doesn't exist
      }
      throw error;
    }
  },

  // Delete from Cloudinary
  async deleteFromCloudinary(cloudinaryId) {
    if (!cloudinaryService) {
      throw new Error('Cloudinary service not available');
    }

    return await cloudinaryService.deleteFile(cloudinaryId);
  },

  // Get file URL
  getFileUrl(fileName, storageType = STORAGE_TYPE) {
    if (storageType === 's3') {
      return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    } else if (storageType === 'cloudinary') {
      if (!cloudinaryService) {
        throw new Error('Cloudinary service not available');
      }
      return cloudinaryService.getFileUrl(fileName);
    } else {
      return `/uploads/${fileName}`;
    }
  },

  // Check if storage is available
  isStorageAvailable() {
    if (STORAGE_TYPE === 's3') {
      return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET_NAME);
    } else if (STORAGE_TYPE === 'cloudinary') {
      return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
    } else {
      return true; // Local storage is always available
    }
  },

  // Get storage type
  getStorageType() {
    return STORAGE_TYPE;
  }
};

module.exports = storageService; 