#!/usr/bin/env node

const { prisma } = require('../prisma/client');

async function debugImprovementOpportunityIssue() {
  console.log('🔍 [DEBUG] Debugging ImprovementOpportunity issue...\n');
  
  const findingId = '758b2aa5-113a-4d10-a764-c6a019465b05';
  
  try {
    // 1. Check the finding directly
    const finding = await prisma.auditFinding.findUnique({
      where: { id: findingId },
      include: {
        nonConformities: true,
        improvements: true,
        compliance: true
      }
    });

    if (!finding) {
      console.error(`❌ [DEBUG] Finding not found: ${findingId}`);
      return;
    }

    console.log('📋 [DEBUG] Finding details:', {
      id: finding.id,
      title: finding.title,
      category: finding.category,
      status: finding.status,
      categorizationFinished: finding.categorizationFinished,
      categorizationFinishedAt: finding.categorizationFinishedAt
    });

    // 2. Check if ImprovementOpportunity exists in database directly
    console.log('\n🔍 [DEBUG] Checking ImprovementOpportunity directly in database...');
    
    const improvementOpportunity = await prisma.improvementOpportunity.findUnique({
      where: { findingId: findingId }
    });

    if (improvementOpportunity) {
      console.log('✅ [DEBUG] ImprovementOpportunity found directly:', {
        id: improvementOpportunity.id,
        findingId: improvementOpportunity.findingId,
        opportunity: improvementOpportunity.opportunity,
        status: improvementOpportunity.status,
        createdById: improvementOpportunity.createdById,
        createdAt: improvementOpportunity.createdAt,
        updatedAt: improvementOpportunity.updatedAt
      });
    } else {
      console.log('❌ [DEBUG] No ImprovementOpportunity found directly for this findingId');
    }

    // 3. Check the relationship query
    console.log('\n🔍 [DEBUG] Checking relationship query...');
    
    const findingWithRelation = await prisma.auditFinding.findUnique({
      where: { id: findingId },
      include: {
        improvements: true
      }
    });

    console.log('📋 [DEBUG] Finding with improvements relation:', {
      hasImprovements: !!findingWithRelation?.improvements,
      improvementsData: findingWithRelation?.improvements ? {
        id: findingWithRelation.improvements.id,
        opportunity: findingWithRelation.improvements.opportunity,
        status: findingWithRelation.improvements.status
      } : null
    });

    // 4. Check if there are multiple ImprovementOpportunity records
    console.log('\n🔍 [DEBUG] Checking for multiple ImprovementOpportunity records...');
    
    const allImprovements = await prisma.improvementOpportunity.findMany({
      where: { findingId: findingId }
    });

    console.log(`📊 [DEBUG] Total ImprovementOpportunity records for this finding: ${allImprovements.length}`);
    
    if (allImprovements.length > 1) {
      console.log('⚠️ [DEBUG] Multiple ImprovementOpportunity records found!');
      allImprovements.forEach((imp, index) => {
        console.log(`   Record ${index + 1}:`, {
          id: imp.id,
          opportunity: imp.opportunity,
          status: imp.status,
          createdAt: imp.createdAt
        });
      });
    }

    // 5. Check the database schema constraints
    console.log('\n🔍 [DEBUG] Checking database constraints...');
    
    // Try to create a duplicate to see if unique constraint works
    try {
      const duplicateTest = await prisma.improvementOpportunity.create({
        data: {
          findingId: findingId,
          createdById: finding.createdById,
          opportunity: 'Test Duplicate',
          status: 'OPEN'
        }
      });
      console.log('⚠️ [DEBUG] WARNING: Was able to create duplicate record!', duplicateTest.id);
      
      // Clean up the test record
      await prisma.improvementOpportunity.delete({
        where: { id: duplicateTest.id }
      });
      console.log('✅ [DEBUG] Cleaned up test duplicate record');
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('✅ [DEBUG] Unique constraint working correctly - cannot create duplicate');
      } else {
        console.log('❌ [DEBUG] Unexpected error during duplicate test:', error.message);
      }
    }

    // 6. Check if the issue is with the Prisma client cache
    console.log('\n🔍 [DEBUG] Checking Prisma client state...');
    
    // Force a fresh query
    await prisma.$disconnect();
    await prisma.$connect();
    
    const freshFinding = await prisma.auditFinding.findUnique({
      where: { id: findingId },
      include: {
        improvements: true
      }
    });

    console.log('📋 [DEBUG] Fresh query result:', {
      hasImprovements: !!freshFinding?.improvements,
      improvementsData: freshFinding?.improvements ? {
        id: freshFinding.improvements.id,
        opportunity: freshFinding.improvements.opportunity,
        status: freshFinding.improvements.status
      } : null
    });

    // 7. Check the exact SQL query being generated
    console.log('\n🔍 [DEBUG] Checking raw SQL query...');
    
    const rawResult = await prisma.$queryRaw`
      SELECT 
        af.id as finding_id,
        af.title as finding_title,
        af.category as finding_category,
        io.id as improvement_id,
        io.opportunity as improvement_opportunity,
        io.status as improvement_status,
        io.created_at as improvement_created_at
      FROM "AuditFinding" af
      LEFT JOIN "ImprovementOpportunity" io ON af.id = io."findingId"
      WHERE af.id = ${findingId}
    `;

    console.log('📋 [DEBUG] Raw SQL query result:', rawResult);

  } catch (error) {
    console.error('❌ [DEBUG] Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugImprovementOpportunityIssue()
  .then(() => {
    console.log('\n🎉 [DEBUG] Debug completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 [DEBUG] Debug failed:', error);
    process.exit(1);
  }); 