#!/usr/bin/env node

const { prisma } = require('../prisma/client');

async function investigateCategorizationFailure() {
  console.log('🔍 [INVESTIGATION] Investigating categorization failure...\n');
  
  const findingId = '758b2aa5-113a-4d10-a764-c6a019465b05';
  
  try {
    // 1. Check the finding details
    const finding = await prisma.auditFinding.findUnique({
      where: { id: findingId },
      include: {
        nonConformities: true,
        improvements: true,
        compliance: true
      }
    });

    if (!finding) {
      console.error(`❌ [INVESTIGATION] Finding not found: ${findingId}`);
      return;
    }

    console.log('📋 [INVESTIGATION] Finding details:', {
      id: finding.id,
      title: finding.title,
      description: finding.description,
      category: finding.category,
      status: finding.status,
      createdAt: finding.createdAt,
      updatedAt: finding.updatedAt,
      categorizationFinished: finding.categorizationFinished,
      categorizationFinishedAt: finding.categorizationFinishedAt
    });

    // 2. Check the ImprovementOpportunity record details
    if (finding.improvements) {
      console.log('📋 [INVESTIGATION] ImprovementOpportunity details:', {
        id: finding.improvements.id,
        opportunity: finding.improvements.opportunity,
        actionPlan: finding.improvements.actionPlan,
        status: finding.improvements.status,
        createdAt: finding.improvements.createdAt,
        updatedAt: finding.improvements.updatedAt,
        createdById: finding.improvements.createdById,
        findingId: finding.improvements.findingId
      });

      // Check if any fields are null/undefined
      const undefinedFields = [];
      Object.entries(finding.improvements).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          undefinedFields.push(key);
        }
      });

      if (undefinedFields.length > 0) {
        console.log('⚠️ [INVESTIGATION] Found undefined/null fields:', undefinedFields);
      } else {
        console.log('✅ [INVESTIGATION] All fields have values');
      }
    }

    // 3. Check when the finding was categorized vs when ImprovementOpportunity was created
    console.log('\n📅 [INVESTIGATION] Timeline Analysis:');
    console.log(`   Finding created: ${finding.createdAt}`);
    console.log(`   Finding updated: ${finding.updatedAt}`);
    console.log(`   Categorization finished: ${finding.categorizationFinishedAt}`);
    
    if (finding.improvements) {
      console.log(`   ImprovementOpportunity created: ${finding.improvements.createdAt}`);
      console.log(`   ImprovementOpportunity updated: ${finding.improvements.updatedAt}`);
      
      // Check if ImprovementOpportunity was created after categorization
      if (finding.categorizationFinishedAt && finding.improvements.createdAt) {
        const categorizationTime = new Date(finding.categorizationFinishedAt);
        const improvementTime = new Date(finding.improvements.createdAt);
        
        if (improvementTime > categorizationTime) {
          console.log('✅ [INVESTIGATION] ImprovementOpportunity created after categorization (correct)');
        } else if (improvementTime < categorizationTime) {
          console.log('⚠️ [INVESTIGATION] ImprovementOpportunity created before categorization (suspicious)');
        } else {
          console.log('✅ [INVESTIGATION] ImprovementOpportunity created at same time as categorization');
        }
      }
    }

    // 4. Check the updateFinding function logic
    console.log('\n🔍 [INVESTIGATION] Checking categorization logic...');
    
    // Simulate what should have happened during categorization
    const shouldCreateImprovement = finding.category === 'IMPROVEMENT' && !finding.improvements;
    console.log(`   Category is IMPROVEMENT: ${finding.category === 'IMPROVEMENT'}`);
    console.log(`   Has existing improvements: ${!!finding.improvements}`);
    console.log(`   Should create ImprovementOpportunity: ${shouldCreateImprovement}`);

    // 5. Check if there are any other findings with similar issues
    console.log('\n🔍 [INVESTIGATION] Checking other IMPROVEMENT findings...');
    
    const allImprovementFindings = await prisma.auditFinding.findMany({
      where: { category: 'IMPROVEMENT' },
      include: {
        improvements: true
      }
    });

    console.log(`   Total IMPROVEMENT findings: ${allImprovementFindings.length}`);
    
    const findingsWithIssues = allImprovementFindings.filter(f => {
      if (!f.improvements) return true;
      return !f.improvements.opportunity || !f.improvements.status;
    });

    console.log(`   Findings with issues: ${findingsWithIssues.length}`);
    
    if (findingsWithIssues.length > 0) {
      console.log('   Findings with issues:');
      findingsWithIssues.forEach(f => {
        console.log(`     - ${f.title} (ID: ${f.id})`);
        console.log(`       Has improvements: ${!!f.improvements}`);
        if (f.improvements) {
          console.log(`       Opportunity: ${f.improvements.opportunity || 'undefined'}`);
          console.log(`       Status: ${f.improvements.status || 'undefined'}`);
        }
      });
    }

    // 6. Check the backend service logic
    console.log('\n🔍 [INVESTIGATION] Backend service analysis...');
    
    // The issue might be in the updateFinding function in findingService.js
    console.log('   Potential issues:');
    console.log('   1. Transaction rollback during categorization');
    console.log('   2. Database constraint violation');
    console.log('   3. Missing error handling in updateFinding function');
    console.log('   4. Race condition during categorization');

  } catch (error) {
    console.error('❌ [INVESTIGATION] Investigation failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateCategorizationFailure()
  .then(() => {
    console.log('\n🎉 [INVESTIGATION] Investigation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 [INVESTIGATION] Investigation failed:', error);
    process.exit(1);
  }); 