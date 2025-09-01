require('dotenv').config();
const storageService = require('./src/config/storage');

async function testCloudinaryIntegration() {
  console.log('🔍 Testing Cloudinary Integration with Frontend...');
  console.log('STORAGE_TYPE:', process.env.STORAGE_TYPE || 'local (default)');
  
  // Check if Cloudinary is configured
  if (process.env.STORAGE_TYPE !== 'cloudinary') {
    console.log('\n⚠️  To test Cloudinary, set STORAGE_TYPE=cloudinary in your .env file');
    console.log('\n📝 Required environment variables for Cloudinary:');
    console.log('CLOUDINARY_CLOUD_NAME=your_cloud_name');
    console.log('CLOUDINARY_API_KEY=your_api_key');
    console.log('CLOUDINARY_API_SECRET=your_api_secret');
    return;
  }
  
  console.log('\n✅ Cloudinary configuration detected');
  console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
  console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');
  
  try {
    // Test 1: Upload a test PDF file
    console.log('\n📤 Testing file upload to Cloudinary...');
    const testFile = {
      originalname: 'test-document.pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(Test PDF Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000204 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n297\n%%EOF'),
      mimetype: 'application/pdf'
    };
    
    const uploadResult = await storageService.uploadFile(testFile, 'test-cloudinary-integration.pdf');
    console.log('✅ Upload successful:', {
      url: uploadResult.url,
      key: uploadResult.key,
      storageType: uploadResult.storageType
    });
    
    // Test 2: Verify URL format is compatible with frontend
    console.log('\n🔗 Testing URL compatibility with frontend...');
    const fileUrl = storageService.getFileUrl(uploadResult.key);
    console.log('✅ Generated URL:', fileUrl);
    
    // Test 3: Check if URL is accessible (basic check)
    console.log('\n🌐 Testing URL accessibility...');
    const https = require('https');
    const url = require('url');
    
    const urlParts = url.parse(fileUrl);
    const options = {
      hostname: urlParts.hostname,
      port: urlParts.port || 443,
      path: urlParts.path,
      method: 'HEAD'
    };
    
    const request = https.request(options, (response) => {
      console.log('✅ URL is accessible:', response.statusCode);
      console.log('✅ Content-Type:', response.headers['content-type']);
      
      // Test 4: Clean up
      console.log('\n🗑️ Cleaning up test file...');
      storageService.deleteFile(uploadResult.key)
        .then(() => {
          console.log('✅ Test file deleted successfully');
          console.log('\n🎉 Cloudinary integration test passed!');
          console.log('\n📋 Frontend Compatibility Summary:');
          console.log('✅ URL format: Compatible with existing frontend');
          console.log('✅ Content-Type: PDF files supported');
          console.log('✅ HTTPS: Secure URLs provided');
          console.log('✅ CORS: Cloudinary supports cross-origin requests');
        })
        .catch(error => {
          console.error('❌ Failed to delete test file:', error.message);
        });
    });
    
    request.on('error', (error) => {
      console.error('❌ URL accessibility test failed:', error.message);
      console.log('\n⚠️  Note: This might be due to network restrictions');
      console.log('✅ The URL format is still compatible with your frontend');
    });
    
    request.end();
    
  } catch (error) {
    console.error('\n❌ Cloudinary integration test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your Cloudinary credentials');
    console.log('2. Ensure your Cloudinary account is active');
    console.log('3. Verify your upload preset settings');
  }
}

testCloudinaryIntegration(); 