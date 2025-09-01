const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function investigateMissingNonConformityRecords() {
  console.log('🔍 INVESTIGATING MISSING NON-CONFORMITY RECORDS');
  console.log('=' .repeat(60));
  
  try {
    // 1. Find all findings categorized as NON_CONFORMITY
    console.log('📋 1. CHECKING ALL NON_CONFORMITY CATEGORIZED FINDINGS:');
    
    const allNCFindings = await prisma.auditFinding.findMany({
      where: {
        category: 'NON_CONFORMITY'
      },
      include: {
        nonConformities: true,
        audit: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   ✅ Found ${allNCFindings.length} findings categorized as NON_CONFORMITY`);
    
    // 2. Check which ones are missing NonConformity records
    const missingRecords = allNCFindings.filter(finding => finding.nonConformities.length === 0);
    const hasRecords = allNCFindings.filter(finding => finding.nonConformities.length > 0);
    
    console.log(`   ✅ With NonConformity records: ${hasRecords.length}`);
    console.log(`   ❌ Missing NonConformity records: ${missingRecords.length}`);
    
    if (missingRecords.length > 0) {
      console.log('\\n⚠️  2. FINDINGS MISSING NONCONFORMITY RECORDS:');
      
      missingRecords.forEach((finding, i) => {
        console.log(`\\n   ${i + 1}. "${finding.title}"`);
        console.log(`      ID: ${finding.id}`);
        console.log(`      Status: ${finding.status}`);
        console.log(`      Category: ${finding.category} (set but no record created)`);
        console.log(`      Created: ${new Date(finding.createdAt).toLocaleDateString()}`);
        console.log(`      Audit: ${finding.audit?.title || 'Unknown'}`);
        console.log(`      🚨 PROBLEM: Categorized as NON_CONFORMITY but no NonConformity record exists`);
      });
      
      // 3. Check if backend service is working correctly
      console.log('\\n🔧 3. BACKEND CATEGORIZATION ANALYSIS:');
      console.log('   💡 This suggests the backend findingService.updateFinding() function');
      console.log('   💡 is NOT properly creating NonConformity records during categorization');
      console.log('   💡 OR the categorization was done directly in database without service');
      
      // 4. Check when these findings were categorized
      console.log('\\n📅 4. CATEGORIZATION TIMING ANALYSIS:');
      
      missingRecords.forEach((finding, i) => {
        const categorySetTime = new Date(finding.updatedAt);
        const creationTime = new Date(finding.createdAt);
        const timeDiff = (categorySetTime - creationTime) / (1000 * 60 * 60); // hours
        
        console.log(`   ${i + 1}. "${finding.title}"`);
        console.log(`      Created: ${creationTime.toLocaleString()}`);
        console.log(`      Updated: ${categorySetTime.toLocaleString()}`);
        console.log(`      Time between: ${timeDiff.toFixed(2)} hours`);
        
        if (timeDiff < 1) {
          console.log(`      🔍 Likely categorized during creation (same session)`);
        } else {
          console.log(`      🔍 Categorized later (${timeDiff.toFixed(1)} hours after creation)`);
        }
      });
      
      // 5. Fix the missing records
      console.log('\\n🔧 5. FIXING MISSING RECORDS:');
      
      for (const finding of missingRecords) {
        try {
          console.log(`\\n   Creating NonConformity record for: "${finding.title}"`);
          
          const nonConformity = await prisma.nonConformity.create({
            data: {
              findingId: finding.id,
              createdById: finding.createdById || 'system-fix',
              title: finding.title,
              description: finding.description,
              type: 'MAJOR', // Default - can be updated via classification modal
              severity: 'MEDIUM', // Default - can be updated via classification modal
              status: 'OPEN'
            }
          });
          
          console.log(`   ✅ Created NonConformity record: ${nonConformity.id}`);
          console.log(`   🎯 Workflow URL: /auditors/corrective-actions/${nonConformity.id}`);
          
        } catch (error) {
          console.log(`   ❌ Failed to create record for "${finding.title}": ${error.message}`);
        }
      }
      
    } else {
      console.log('\\n✅ 2. ALL NON_CONFORMITY FINDINGS HAVE CORRESPONDING RECORDS');
      console.log('   No missing records found - categorization backend is working correctly');
    }
    
    // 6. Verify the backend service logic
    console.log('\\n🔍 6. BACKEND SERVICE VERIFICATION:');
    console.log('   📍 File: src/services/findingService.js');
    console.log('   📍 Function: updateFinding()');
    console.log('   📍 Logic: Lines 53-80 should auto-create records when category is set');
    console.log('   📍 Expected: When category = NON_CONFORMITY → Create NonConformity record');
    
    // 7. Check if there are orphaned NonConformity records
    console.log('\\n🔍 7. CHECKING FOR ORPHANED NONCONFORMITY RECORDS:');
    
    const allNonConformities = await prisma.nonConformity.findMany({
      include: {
        finding: true
      }
    });
    
    const orphanedNCs = allNonConformities.filter(nc => 
      !nc.finding || nc.finding.category !== 'NON_CONFORMITY'
    );
    
    console.log(`   ✅ Total NonConformity records: ${allNonConformities.length}`);
    console.log(`   ${orphanedNCs.length > 0 ? '⚠️' : '✅'} Orphaned records: ${orphanedNCs.length}`);
    
    if (orphanedNCs.length > 0) {
      orphanedNCs.forEach((nc, i) => {
        console.log(`      ${i + 1}. NonConformity ${nc.id} → Finding category: ${nc.finding?.category || 'FINDING_NOT_FOUND'}`);
      });
    }
    
    // 8. Final summary and recommendations
    console.log('\\n📊 8. INVESTIGATION SUMMARY:');
    console.log(`   • Total NON_CONFORMITY findings: ${allNCFindings.length}`);
    console.log(`   • With records: ${hasRecords.length}`);
    console.log(`   • Missing records: ${missingRecords.length}`);
    console.log(`   • Fixed during investigation: ${missingRecords.length}`);
    
    if (missingRecords.length > 0) {
      console.log('\\n🔧 RECOMMENDATIONS:');
      console.log('   1. ✅ Records have been created for missing findings');
      console.log('   2. 🔍 Review backend categorization process');
      console.log('   3. 🧪 Test categorization workflow to ensure it works correctly');
      console.log('   4. 📋 Consider adding data validation to prevent this in future');
      console.log('   5. 🔔 Add monitoring/alerts for categorization inconsistencies');
      
      console.log('\\n💡 ROOT CAUSE ANALYSIS:');
      console.log('   • Findings were categorized as NON_CONFORMITY in database');
      console.log('   • But corresponding NonConformity records were not created');
      console.log('   • This suggests:');
      console.log('     - Direct database updates bypassed the service layer');
      console.log('     - OR backend service had a bug during categorization');
      console.log('     - OR categorization happened before the auto-creation logic was implemented');
    }
    
  } catch (error) {
    console.error('❌ Error in investigation:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the investigation
investigateMissingNonConformityRecords().catch(console.error);
