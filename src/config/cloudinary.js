const cloudinary = require('cloudinary').v2;

// Configure Cloudinary using the URL format (preferred method)
if (process.env.CLOUDINARY_URL) {
  // Use the URL format if available
  cloudinary.config({
    url: process.env.CLOUDINARY_URL
  });
  console.log('✅ Cloudinary configured using CLOUDINARY_URL');
} else {
  // Fallback to individual credentials
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary configured using individual credentials');
}

const cloudinaryService = {
  async uploadFile(file, folder = 'documents') {
    try {
      console.log('📤 Uploading to Cloudinary:', {
        fileName: file.originalname,
        fileSize: file.size,
        folder: folder
      });

      // Create upload options
      const uploadOptions = {
        folder: folder,
        resource_type: 'raw', // For PDFs and other files
        public_id: `${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, '')}`,
        overwrite: true,
        invalidate: true
      };

      // Upload the file using upload_stream for better handling
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary upload error:', error);
              reject(new Error(`Failed to upload to Cloudinary: ${error.message}`));
            } else {
              console.log('✅ Cloudinary upload successful:', {
                publicId: result.public_id,
                url: result.secure_url,
                format: result.format
              });
              
              resolve({
                url: result.secure_url,
                key: result.public_id,
                storageType: 'cloudinary',
                cloudinaryId: result.public_id
              });
            }
          }
        );
        
        uploadStream.end(file.buffer);
      });
    } catch (error) {
      console.error('❌ Cloudinary upload failed:', error);
      throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
    }
  },

  async deleteFile(cloudinaryId) {
    try {
      const result = await cloudinary.uploader.destroy(cloudinaryId, {
        resource_type: 'raw'
      });
      console.log('✅ Cloudinary delete successful:', result);
      return result;
    } catch (error) {
      console.error('❌ Cloudinary delete failed:', error);
      throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
    }
  },

  getFileUrl(cloudinaryId, options = {}) {
    const defaultOptions = {
      secure: true,
      quality: 'auto',
      fetch_format: 'auto'
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    return cloudinary.url(cloudinaryId, {
      ...finalOptions,
      resource_type: 'raw'
    });
  },

  isConfigured() {
    return !!(process.env.CLOUDINARY_URL || 
              (process.env.CLOUDINARY_CLOUD_NAME && 
               process.env.CLOUDINARY_API_KEY && 
               process.env.CLOUDINARY_API_SECRET));
  },

  async getStorageInfo() {
    try {
      const accountInfo = await cloudinary.api.account();
      return {
        cloudName: accountInfo.cloud_name,
        plan: accountInfo.plan,
        credits: accountInfo.credits,
        objects: accountInfo.objects,
        bytes: accountInfo.bytes,
        bandwidth: accountInfo.bandwidth
      };
    } catch (error) {
      console.error('❌ Failed to get Cloudinary storage info:', error);
      return null;
    }
  }
};

module.exports = cloudinaryService; 