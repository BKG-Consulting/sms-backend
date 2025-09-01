require('dotenv').config();
const AWS = require('aws-sdk');

// Configure AWS
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

async function testAWSCredentials() {
  console.log('🔍 Testing AWS Credentials...');
  console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Missing');
  console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Missing');
  console.log('AWS_REGION:', process.env.AWS_REGION || '❌ Missing');
  console.log('AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME || '❌ Missing');
  
  try {
    // Test 1: List buckets to verify credentials
    console.log('\n📋 Testing bucket listing...');
    const buckets = await s3.listBuckets().promise();
    console.log('✅ Successfully listed buckets:', buckets.Buckets.map(b => b.Name));
    
    // Test 2: Check if our bucket exists
    console.log('\n🪣 Testing bucket access...');
    const bucketName = process.env.AWS_S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error('AWS_S3_BUCKET_NAME not set');
    }
    
    const bucketExists = buckets.Buckets.some(b => b.Name === bucketName);
    if (!bucketExists) {
      throw new Error(`Bucket '${bucketName}' not found in your AWS account`);
    }
    console.log(`✅ Bucket '${bucketName}' found`);
    
    // Test 3: Try to list objects in the bucket
    console.log('\n📁 Testing bucket object listing...');
    const objects = await s3.listObjectsV2({ Bucket: bucketName, MaxKeys: 5 }).promise();
    console.log(`✅ Successfully listed objects in bucket (${objects.Contents.length} objects found)`);
    
    // Test 4: Try to upload a small test file
    console.log('\n📤 Testing file upload...');
    const testKey = `test-${Date.now()}.txt`;
    const uploadResult = await s3.upload({
      Bucket: bucketName,
      Key: testKey,
      Body: 'Test file content',
      ContentType: 'text/plain',
    }).promise();
    console.log('✅ Successfully uploaded test file:', uploadResult.Location);
    
    // Test 5: Clean up - delete the test file
    console.log('\n🗑️ Cleaning up test file...');
    await s3.deleteObject({
      Bucket: bucketName,
      Key: testKey,
    }).promise();
    console.log('✅ Successfully deleted test file');
    
    console.log('\n🎉 All AWS tests passed! Your credentials are working correctly.');
    
  } catch (error) {
    console.error('\n❌ AWS Test Failed:', error.message);
    console.error('Error Code:', error.code);
    console.error('Error Status Code:', error.statusCode);
    
    if (error.code === 'InvalidAccessKeyId') {
      console.error('\n🔧 Troubleshooting:');
      console.error('1. Check if your AWS Access Key ID is correct');
      console.error('2. Verify the Access Key exists in your AWS account');
      console.error('3. Ensure the Access Key is active and not disabled');
      console.error('4. Check if you\'re using the correct AWS account');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.error('\n🔧 Troubleshooting:');
      console.error('1. Check if your AWS Secret Access Key is correct');
      console.error('2. Ensure there are no extra spaces or characters');
    } else if (error.code === 'NoSuchBucket') {
      console.error('\n🔧 Troubleshooting:');
      console.error('1. Check if the bucket name is correct');
      console.error('2. Verify the bucket exists in the specified region');
      console.error('3. Ensure you have permissions to access the bucket');
    }
  }
}

testAWSCredentials(); 