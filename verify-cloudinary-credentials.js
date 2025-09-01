require('dotenv').config();
const cloudinary = require('cloudinary').v2;

async function verifyCloudinaryCredentials() {
  console.log('🔍 Verifying Cloudinary Credentials...');
  
  // Check environment variables
  console.log('\n📋 Environment Variables:');
  console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || '❌ Missing');
  console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ Missing');
  
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.log('\n❌ Missing required Cloudinary credentials');
    console.log('\n📝 Please add these to your .env file:');
    console.log('CLOUDINARY_CLOUD_NAME=your_cloud_name');
    console.log('CLOUDINARY_API_KEY=your_api_key');
    console.log('CLOUDINARY_API_SECRET=your_api_secret');
    return;
  }
  
  // Configure Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  
  try {
    console.log('\n🔐 Testing Cloudinary authentication...');
    
    // Test 1: Get account info (this will verify credentials)
    const accountInfo = await cloudinary.api.ping();
    console.log('✅ Authentication successful:', accountInfo);
    
    // Test 2: Get account details
    const accountDetails = await cloudinary.api.account();
    console.log('✅ Account details retrieved:');
    console.log('   - Cloud Name:', accountDetails.cloud_name);
    console.log('   - Plan:', accountDetails.plan);
    console.log('   - Credits:', accountDetails.credits);
    console.log('   - Objects:', accountDetails.objects);
    console.log('   - Bytes:', accountDetails.bytes);
    console.log('   - Bandwidth:', accountDetails.bandwidth);
    
    // Test 3: List upload presets
    console.log('\n📁 Checking upload presets...');
    try {
      const presets = await cloudinary.api.upload_presets();
      console.log('✅ Upload presets found:', presets.presets?.length || 0);
      if (presets.presets && presets.presets.length > 0) {
        console.log('   Available presets:');
        presets.presets.forEach(preset => {
          console.log(`   - ${preset.name} (${preset.folder || 'root'})`);
        });
      }
    } catch (presetError) {
      console.log('⚠️  Could not retrieve upload presets:', presetError.message);
    }
    
    console.log('\n🎉 Cloudinary credentials are valid!');
    console.log('\n📝 Next steps:');
    console.log('1. Your credentials are working correctly');
    console.log('2. You can now test file uploads');
    console.log('3. Run: node test-cloudinary-integration.js');
    
  } catch (error) {
    console.error('\n❌ Cloudinary authentication failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Double-check your credentials in the Cloudinary dashboard');
    console.log('2. Ensure your account is active (not suspended)');
    console.log('3. Check if you have API access enabled');
    console.log('4. Verify the cloud name is correct (no spaces or special chars)');
    
    if (error.http_code === 401) {
      console.log('\n🔑 401 Error - Invalid credentials:');
      console.log('   - Check your API Key and API Secret');
      console.log('   - Ensure they match exactly with your dashboard');
    } else if (error.http_code === 403) {
      console.log('\n🚫 403 Error - Access denied:');
      console.log('   - Check if your account is active');
      console.log('   - Verify API access is enabled');
    }
  }
}

verifyCloudinaryCredentials(); 