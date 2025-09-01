#!/usr/bin/env node

const { prisma } = require('../prisma/client');

async function fixMissingImprovementOpportunity() {
  console.log('🔧 [FIX_IMPROVEMENT] Fixing missing ImprovementOpportunity record...\n');
  
  const findingId = '758b2aa5-113a-4d10-a764-c6a019465b05';
  
  try {
    // 1. Check the current finding
    const finding = await prisma.auditFinding.findUnique({
      where: { id: findingId },
      include: {
        nonConformities: true,
        improvements: true,
        compliance: true
      }
    });

    if (!finding) {
      console.error(`❌ [FIX_IMPROVEMENT] Finding not found: ${findingId}`);
      return;
    }

    console.log('📋 [FIX_IMPROVEMENT] Current finding state:', {
      id: finding.id,
      title: finding.title,
      category: finding.category,
      hasNonConformities: !!finding.nonConformities?.length,
      hasImprovements: !!finding.improvements,
      hasCompliance: !!finding.compliance
    });

    // 2. Check if ImprovementOpportunity already exists
    if (finding.improvements) {
      console.log('✅ [FIX_IMPROVEMENT] ImprovementOpportunity already exists:', {
        id: finding.improvements.id,
        opportunity: finding.improvements.opportunity,
        status: finding.improvements.status
      });
      return;
    }

    // 3. Create the missing ImprovementOpportunity
    if (finding.category === 'IMPROVEMENT') {
      console.log('🔧 [FIX_IMPROVEMENT] Creating missing ImprovementOpportunity...');
      
      const improvementOpportunity = await prisma.improvementOpportunity.create({
        data: {
          findingId: finding.id,
          createdById: finding.createdById,
          opportunity: finding.title || 'Improvement Opportunity',
          actionPlan: '',
          status: 'OPEN',
        }
      });

      console.log('✅ [FIX_IMPROVEMENT] Successfully created ImprovementOpportunity:', {
        id: improvementOpportunity.id,
        opportunity: improvementOpportunity.opportunity,
        status: improvementOpportunity.status
      });

      // 4. Verify the fix
      const updatedFinding = await prisma.auditFinding.findUnique({
        where: { id: findingId },
        include: {
          nonConformities: true,
          improvements: true,
          compliance: true
        }
      });

      console.log('✅ [FIX_IMPROVEMENT] Verification - Updated finding state:', {
        id: updatedFinding.id,
        title: updatedFinding.title,
        category: updatedFinding.category,
        hasNonConformities: !!updatedFinding.nonConformities?.length,
        hasImprovements: !!updatedFinding.improvements,
        hasCompliance: !!updatedFinding.compliance,
        improvementDetails: updatedFinding.improvements ? {
          id: updatedFinding.improvements.id,
          opportunity: updatedFinding.improvements.opportunity,
          status: updatedFinding.improvements.status
        } : null
      });

    } else {
      console.log(`⚠️ [FIX_IMPROVEMENT] Finding is not categorized as IMPROVEMENT (current: ${finding.category})`);
    }

  } catch (error) {
    console.error('❌ [FIX_IMPROVEMENT] Fix failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixMissingImprovementOpportunity()
  .then(() => {
    console.log('\n🎉 [FIX_IMPROVEMENT] Fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 [FIX_IMPROVEMENT] Fix failed:', error);
    process.exit(1);
  }); 