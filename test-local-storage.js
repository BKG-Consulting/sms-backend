require('dotenv').config();
const storageService = require('./src/config/storage');

async function testLocalStorage() {
  console.log('🔍 Testing Local Storage...');
  console.log('STORAGE_TYPE:', process.env.STORAGE_TYPE || 'local (default)');
  console.log('LOCAL_STORAGE_PATH:', process.env.LOCAL_STORAGE_PATH || './uploads (default)');
  
  try {
    // Test file object (simulating multer file)
    const testFile = {
      originalname: 'test-document.txt',
      buffer: Buffer.from('This is a test document content'),
      mimetype: 'text/plain'
    };
    
    const fileName = `test-${Date.now()}.txt`;
    
    console.log('\n📤 Testing file upload...');
    const uploadResult = await storageService.uploadFile(testFile, fileName);
    console.log('✅ Upload successful:', uploadResult);
    
    console.log('\n🔗 Testing file URL generation...');
    const fileUrl = storageService.getFileUrl(fileName);
    console.log('✅ File URL:', fileUrl);
    
    console.log('\n🗑️ Testing file deletion...');
    const deleteResult = await storageService.deleteFile(fileName);
    console.log('✅ Delete successful:', deleteResult);
    
    console.log('\n🎉 Local storage test passed!');
    console.log('\n📝 To use local storage, set these environment variables:');
    console.log('STORAGE_TYPE=local');
    console.log('LOCAL_STORAGE_PATH=./uploads (optional, defaults to ./uploads)');
    
  } catch (error) {
    console.error('\n❌ Local storage test failed:', error.message);
  }
}

testLocalStorage(); 