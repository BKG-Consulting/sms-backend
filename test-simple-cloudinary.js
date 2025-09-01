require('dotenv').config();
const cloudinary = require('cloudinary').v2;

async function testSimpleCloudinary() {
  console.log('🔍 Simple Cloudinary Test...');
  
  // Check environment variables
  console.log('\n📋 Environment Variables:');
  console.log('CLOUDINARY_URL:', process.env.CLOUDINARY_URL ? '✅ Set' : '❌ Missing');
  console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || '❌ Missing');
  console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');
  
  if (!process.env.CLOUDINARY_URL && (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)) {
    console.log('\n❌ Missing required Cloudinary credentials');
    console.log('\n📝 Please add either:');
    console.log('CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name');
    console.log('OR individual credentials:');
    console.log('CLOUDINARY_CLOUD_NAME=your_cloud_name');
    console.log('CLOUDINARY_API_KEY=your_api_key');
    console.log('CLOUDINARY_API_SECRET=your_api_secret');
    return;
  }
  
  // Configure Cloudinary
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({
      url: process.env.CLOUDINARY_URL
    });
    console.log('\n✅ Using CLOUDINARY_URL configuration');
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    console.log('\n✅ Using individual credentials configuration');
  }
  
  try {
    console.log('\n🔐 Testing basic authentication...');
    
    // Simple ping test
    const pingResult = await cloudinary.api.ping();
    console.log('✅ Ping successful:', pingResult);
    
    // Test account info using the correct method
    console.log('\n📊 Getting account information...');
    try {
      const usageInfo = await cloudinary.api.usage();
      console.log('✅ Account usage info retrieved:');
      console.log('   - Plan:', usageInfo.plan);
      console.log('   - Credits:', usageInfo.credits);
      console.log('   - Objects:', usageInfo.objects);
      console.log('   - Bandwidth:', usageInfo.bandwidth);
      console.log('   - Storage:', usageInfo.storage);
    } catch (usageError) {
      console.log('⚠️  Could not get usage info:', usageError.message);
    }
    
    console.log('\n🎉 Basic Cloudinary test passed!');
    console.log('\n📝 Next steps:');
    console.log('1. Your credentials are working correctly');
    console.log('2. You can now test file uploads');
    console.log('3. Run: node test-cloudinary-integration.js');
    
  } catch (error) {
    console.error('\n❌ Cloudinary test failed:', error.message);
    console.error('Error details:', error);
    
    if (error.http_code) {
      console.log('\nHTTP Code:', error.http_code);
    }
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your Cloudinary dashboard for correct credentials');
    console.log('2. Ensure your account is active');
    console.log('3. Try logging into cloudinary.com to verify account status');
    console.log('4. Verify the CLOUDINARY_URL format is correct');
  }
}

testSimpleCloudinary(); 