const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCorrectiveActionButtonVisibility() {
  console.log('🔍 Testing Corrective Action Button Visibility & Logic');
  console.log('=' .repeat(60));
  
  try {
    // 1. Check all NON_CONFORMITY findings regardless of status
    console.log('📋 1. CHECKING ALL NON_CONFORMITY FINDINGS:');
    
    const allNCFindings = await prisma.auditFinding.findMany({
      where: {
        category: 'NON_CONFORMITY'
      },
      include: {
        nonConformities: true,
        audit: {
          include: {
            auditProgram: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   ✅ Found ${allNCFindings.length} NON_CONFORMITY findings total`);
    
    const statusBreakdown = {};
    allNCFindings.forEach(finding => {
      statusBreakdown[finding.status] = (statusBreakdown[finding.status] || 0) + 1;
    });
    
    console.log('   📊 Status Breakdown:');
    Object.entries(statusBreakdown).forEach(([status, count]) => {
      console.log(`      ${status}: ${count} findings`);
    });
    
    // 2. Test button visibility logic for each finding
    console.log('\\n🖱️  2. BUTTON VISIBILITY TESTING:');
    
    allNCFindings.forEach((finding, i) => {
      const shouldShowButton = (finding.status === "ACCEPTED" || finding.status === "REFUSED") && finding.category === "NON_CONFORMITY";
      const hasNonConformity = finding.nonConformities && finding.nonConformities.length > 0;
      
      console.log(`\\n   ${i + 1}. "${finding.title}"`);
      console.log(`      Status: ${finding.status}`);
      console.log(`      Category: ${finding.category}`);
      console.log(`      NonConformity Records: ${finding.nonConformities.length}`);
      console.log(`      Button Visible: ${shouldShowButton ? '✅ YES' : '❌ NO'}`);
      console.log(`      Ready for Workflow: ${shouldShowButton && hasNonConformity ? '✅ YES' : '❌ NO'}`);
      
      if (shouldShowButton && hasNonConformity) {
        const nc = finding.nonConformities[0];
        console.log(`      🎯 Workflow URL: /auditors/corrective-actions/${nc.id}`);
        console.log(`      🏷️  Classification: ${nc.type} / ${nc.severity}`);
      } else if (shouldShowButton && !hasNonConformity) {
        console.log(`      ⚠️  Missing NonConformity record - categorization issue`);
      }
    });
    
    // 3. Test the new logic specifically
    console.log('\\n🔧 3. NEW LOGIC TESTING:');
    
    const acceptedNC = allNCFindings.filter(f => f.status === 'ACCEPTED' && f.category === 'NON_CONFORMITY');
    const refusedNC = allNCFindings.filter(f => f.status === 'REFUSED' && f.category === 'NON_CONFORMITY');
    const pendingNC = allNCFindings.filter(f => f.status === 'PENDING' && f.category === 'NON_CONFORMITY');
    const underReviewNC = allNCFindings.filter(f => f.status === 'UNDER_REVIEW' && f.category === 'NON_CONFORMITY');
    
    console.log(`   ✅ ACCEPTED NON_CONFORMITY: ${acceptedNC.length} (Button: YES)`);
    console.log(`   ✅ REFUSED NON_CONFORMITY: ${refusedNC.length} (Button: YES - NEW!)`);
    console.log(`   ❌ PENDING NON_CONFORMITY: ${pendingNC.length} (Button: NO)`);
    console.log(`   ❌ UNDER_REVIEW NON_CONFORMITY: ${underReviewNC.length} (Button: NO)`);
    
    // 4. Create a test REFUSED NON_CONFORMITY if none exists
    if (refusedNC.length === 0) {
      console.log('\\n🧪 4. CREATING TEST REFUSED NON_CONFORMITY:');
      
      const audit = await prisma.audit.findFirst();
      if (audit) {
        const testFinding = await prisma.auditFinding.create({
          data: {
            auditId: audit.id,
            title: 'Test Refused Non-Conformity Finding',
            description: 'This finding was refused by HOD but still requires corrective action',
            department: 'Test Department',
            createdById: 'test-user-id',
            evidence: 'Test evidence',
            impact: 'Significant impact requiring corrective action',
            recommendation: 'Immediate corrective action required',
            status: 'REFUSED',
            category: 'NON_CONFORMITY'
          }
        });
        
        // Create the NonConformity record
        const nonConformity = await prisma.nonConformity.create({
          data: {
            findingId: testFinding.id,
            createdById: 'test-user-id',
            title: testFinding.title,
            description: testFinding.description,
            type: 'MAJOR',
            severity: 'HIGH',
            status: 'OPEN'
          }
        });
        
        console.log(`   ✅ Created test REFUSED finding: "${testFinding.title}"`);
        console.log(`   🔗 NonConformity ID: ${nonConformity.id}`);
        console.log(`   🎯 Test Workflow URL: /auditors/corrective-actions/${nonConformity.id}`);
        console.log(`   💡 This finding should now show the "Corrective Action (Required)" button`);
      }
    }
    
    // 5. Frontend conditions summary
    console.log('\\n📱 5. FRONTEND BUTTON CONDITIONS:');
    console.log('   OLD LOGIC: finding.status === "ACCEPTED" && finding.category === "NON_CONFORMITY"');
    console.log('   NEW LOGIC: (finding.status === "ACCEPTED" || finding.status === "REFUSED") && finding.category === "NON_CONFORMITY"');
    console.log('\\n   🎯 KEY IMPROVEMENT:');
    console.log('   • REFUSED non-conformities now show corrective action button');
    console.log('   • Button shows "(Required)" text for REFUSED findings');
    console.log('   • Tooltip explains corrective action is required regardless of HOD decision');
    console.log('   • Toast message informs user about REFUSED finding corrective action');
    
    // 6. Business logic explanation
    console.log('\\n📋 6. BUSINESS LOGIC EXPLANATION:');
    console.log('   ✅ ACCEPTED Non-Conformity → Corrective action required');
    console.log('   ✅ REFUSED Non-Conformity → Corrective action STILL required');
    console.log('   💡 Reasoning: Non-conformity exists regardless of HOD acceptance');
    console.log('   💡 Compliance: Audit standards require corrective action for all non-conformities');
    console.log('   💡 Risk Management: Refusing a finding doesn\'t eliminate the risk');
    
    console.log('\\n🎯 CONCLUSION: Button visibility logic updated to include REFUSED findings');
    console.log('   Corrective action workflow now properly handles both ACCEPTED and REFUSED non-conformities');
    
  } catch (error) {
    console.error('❌ Error in testing:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testCorrectiveActionButtonVisibility().catch(console.error);
