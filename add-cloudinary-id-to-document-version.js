const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function addCloudinaryIdToDocumentVersion() {
  try {
    console.log('🔧 Adding cloudinaryId field to DocumentVersion model...');
    
    // Read the current schema
    const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
    let schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Find the DocumentVersion model
    const documentVersionModelRegex = /model DocumentVersion \{[\s\S]*?\n\}/;
    const match = schemaContent.match(documentVersionModelRegex);
    
    if (!match) {
      console.error('❌ Could not find DocumentVersion model in schema');
      return;
    }
    
    const currentModel = match[0];
    console.log('📋 Current DocumentVersion model:');
    console.log(currentModel);
    
    // Check if cloudinaryId already exists
    if (currentModel.includes('cloudinaryId')) {
      console.log('✅ cloudinaryId field already exists in DocumentVersion model');
      return;
    }
    
    // Add cloudinaryId field after s3Key
    const updatedModel = currentModel.replace(
      /s3Key\s+String\?/,
      's3Key           String?\n  cloudinaryId     String?'
    );
    
    // Replace the model in the schema
    const updatedSchema = schemaContent.replace(currentModel, updatedModel);
    
    // Write the updated schema
    fs.writeFileSync(schemaPath, updatedSchema, 'utf8');
    
    console.log('✅ Updated schema with cloudinaryId field');
    console.log('📋 Updated DocumentVersion model:');
    console.log(updatedModel);
    
    console.log('\n🔍 Next steps:');
    console.log('   1. Generate and run the Prisma migration:');
    console.log('      npx prisma migrate dev --name add_cloudinary_id_to_document_version');
    console.log('   2. Restart your backend server');
    console.log('   3. Test the change request apply functionality');
    
  } catch (error) {
    console.error('❌ Error updating schema:', error);
  }
}

// Run the script
addCloudinaryIdToDocumentVersion(); 