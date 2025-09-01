const express = require('express');
const multer = require('multer');
const { authenticateToken, requirePermission } = require('../middleware/authMiddleware');
const uploadController = require('../controllers/uploadController');
const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp', 'image/x-icon'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'), false);
    }
  }
});

// File upload routes
router.post('/logo', 
  authenticateToken, 
  requirePermission('tenant', 'update'), 
  upload.single('logo'), 
  uploadController.uploadLogo
);

router.post('/favicon', 
  authenticateToken, 
  requirePermission('tenant', 'update'), 
  upload.single('favicon'), 
  uploadController.uploadFavicon
);

router.post('/branding-assets', 
  authenticateToken, 
  requirePermission('tenant', 'update'), 
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
  ]), 
  uploadController.uploadBrandingAssets
);

// Delete uploaded files
router.delete('/logo/:s3Key', 
  authenticateToken, 
  requirePermission('tenant', 'update'), 
  uploadController.deleteLogo
);

router.delete('/favicon/:s3Key', 
  authenticateToken, 
  requirePermission('tenant', 'update'), 
  uploadController.deleteFavicon
);

// List branding files for a tenant
router.get('/branding-files/:tenantId', 
  authenticateToken, 
  requirePermission('tenant', 'read'), 
  uploadController.listBrandingFiles
);

// Get signed URL for secure access
router.get('/signed-url/:s3Key', 
  authenticateToken, 
  requirePermission('tenant', 'read'), 
  uploadController.getSignedUrl
);

module.exports = router; 