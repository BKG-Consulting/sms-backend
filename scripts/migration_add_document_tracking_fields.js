const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateDocumentTrackingFields() {
  try {
    console.log('🔄 Starting migration: Adding document tracking fields...');
    
    // Step 1: Add new fields to Document table
    console.log('📄 Adding tracking fields to Document table...');
    
    // Add lastUpdatedViaChangeRequest column
    await prisma.$executeRaw`
      ALTER TABLE "Document" 
      ADD COLUMN IF NOT EXISTS "lastUpdatedViaChangeRequest" TIMESTAMP(3)
    `;
    
    // Add isRecentlyUpdated column
    await prisma.$executeRaw`
      ALTER TABLE "Document" 
      ADD COLUMN IF NOT EXISTS "isRecentlyUpdated" BOOLEAN NOT NULL DEFAULT false
    `;
    
    console.log('✅ Added tracking fields to Document table');
    
    // Step 2: Add status field to DocumentVersion table
    console.log('📄 Adding status field to DocumentVersion table...');
    
    // Add status column with default value
    await prisma.$executeRaw`
      ALTER TABLE "DocumentVersion" 
      ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE'
    `;
    
    console.log('✅ Added status field to DocumentVersion table');
    
    // Step 3: Update all existing DocumentVersion records to have ACTIVE status
    console.log('🔄 Updating existing DocumentVersion records...');
    
    const updateResult = await prisma.documentVersion.updateMany({
      data: {
        status: 'ACTIVE'
      }
    });
    
    console.log(`✅ Updated ${updateResult.count} DocumentVersion records to ACTIVE status`);
    
    // Step 4: Create index for better performance
    console.log('📊 Creating indexes for better performance...');
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "DocumentVersion_status_idx" ON "DocumentVersion"("status")
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Document_isRecentlyUpdated_idx" ON "Document"("isRecentlyUpdated")
    `;
    
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "Document_lastUpdatedViaChangeRequest_idx" ON "Document"("lastUpdatedViaChangeRequest")
    `;
    
    console.log('✅ Created performance indexes');
    
    // Step 5: Verify the migration
    console.log('🔍 Verifying migration...');
    
    const documentCount = await prisma.document.count();
    const versionCount = await prisma.documentVersion.count();
    const activeVersions = await prisma.documentVersion.count({
      where: { status: 'ACTIVE' }
    });
    
    console.log(`📊 Migration verification:`);
    console.log(`   - Total documents: ${documentCount}`);
    console.log(`   - Total document versions: ${versionCount}`);
    console.log(`   - Active document versions: ${activeVersions}`);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Summary of changes:');
    console.log('   ✅ Added lastUpdatedViaChangeRequest field to Document table');
    console.log('   ✅ Added isRecentlyUpdated field to Document table');
    console.log('   ✅ Added status field to DocumentVersion table');
    console.log('   ✅ Set all existing versions to ACTIVE status');
    console.log('   ✅ Created performance indexes');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateDocumentTrackingFields(); 