#!/usr/bin/env node

const { prisma } = require('../prisma/client');
const findingRepository = require('../src/repositories/findingRepository');

async function testImprovementRelationshipFix() {
  console.log('🧪 [TEST] Testing ImprovementOpportunity relationship fix...\n');
  
  const findingId = '758b2aa5-113a-4d10-a764-c6a019465b05';
  
  try {
    // 1. Test the repository function directly
    console.log('🔍 [TEST] Testing getFindingById repository function...');
    
    const finding = await findingRepository.getFindingById(findingId);
    
    if (!finding) {
      console.error(`❌ [TEST] Finding not found: ${findingId}`);
      return;
    }
    
    console.log('✅ [TEST] Finding retrieved successfully:', {
      id: finding.id,
      title: finding.title,
      category: finding.category,
      hasImprovements: !!finding.improvements,
      improvementsData: finding.improvements ? {
        id: finding.improvements.id,
        opportunity: finding.improvements.opportunity,
        status: finding.improvements.status
      } : null
    });
    
    // 2. Test the getFindingsByAudit function
    console.log('\n🔍 [TEST] Testing getFindingsByAudit repository function...');
    
    // Get the audit ID from the finding
    const auditFinding = await prisma.auditFinding.findUnique({
      where: { id: findingId },
      select: { auditId: true, audit: { select: { auditProgram: { select: { tenantId: true } } } } }
    });
    
    if (!auditFinding) {
      console.error(`❌ [TEST] Could not get audit info for finding: ${findingId}`);
      return;
    }
    
    const findings = await findingRepository.getFindingsByAudit(auditFinding.auditId, auditFinding.audit.auditProgram.tenantId);
    
    console.log(`✅ [TEST] Retrieved ${findings.length} findings from audit`);
    
    const testFinding = findings.find(f => f.id === findingId);
    if (testFinding) {
      console.log('✅ [TEST] Test finding found in audit results:', {
        id: testFinding.id,
        title: testFinding.title,
        category: testFinding.category,
        hasImprovements: !!testFinding.improvements,
        improvementsData: testFinding.improvements ? {
          id: testFinding.improvements.id,
          opportunity: testFinding.improvements.opportunity,
          status: testFinding.improvements.status
        } : null
      });
    } else {
      console.error(`❌ [TEST] Test finding not found in audit results`);
    }
    
    // 3. Test the service layer
    console.log('\n🔍 [TEST] Testing findingService.getFindingById...');
    
    const findingService = require('../src/services/findingService');
    const serviceFinding = await findingService.getFindingById(findingId);
    
    console.log('✅ [TEST] Service layer result:', {
      id: serviceFinding.id,
      title: serviceFinding.title,
      category: serviceFinding.category,
      hasImprovements: !!serviceFinding.improvements,
      improvementsData: serviceFinding.improvements ? {
        id: serviceFinding.improvements.id,
        opportunity: serviceFinding.improvements.opportunity,
        status: serviceFinding.improvements.status
      } : null
    });
    
    // 4. Summary
    console.log('\n📊 [TEST] Test Summary:');
    console.log(`   Repository getFindingById: ${finding.improvements ? '✅ Working' : '❌ Failed'}`);
    console.log(`   Repository getFindingsByAudit: ${testFinding?.improvements ? '✅ Working' : '❌ Failed'}`);
    console.log(`   Service getFindingById: ${serviceFinding.improvements ? '✅ Working' : '❌ Failed'}`);
    
    if (finding.improvements && testFinding?.improvements && serviceFinding.improvements) {
      console.log('\n🎉 [TEST] All tests passed! The relationship fix is working correctly.');
    } else {
      console.log('\n⚠️ [TEST] Some tests failed. The relationship fix may need further investigation.');
    }
    
  } catch (error) {
    console.error('❌ [TEST] Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testImprovementRelationshipFix()
  .then(() => {
    console.log('\n🎉 [TEST] Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 [TEST] Test failed:', error);
    process.exit(1);
  }); 