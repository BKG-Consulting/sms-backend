const { prisma } = require('../prisma/client');

async function auditImprovementOpportunityRecords() {
  console.log('🔍 [AUDIT] Starting audit of ImprovementOpportunity records...\n');

  try {
    // 1. Get all findings categorized as IMPROVEMENT
    console.log('📊 Step 1: Fetching all IMPROVEMENT findings...');
    const improvementFindings = await prisma.auditFinding.findMany({
      where: {
        category: 'IMPROVEMENT'
      },
      select: {
        id: true,
        title: true,
        department: true,
        category: true,
        createdAt: true,
        updatedAt: true,
        audit: {
          select: {
            id: true,
            auditNo: true,
            auditProgram: {
              select: {
                id: true,
                title: true,
                tenant: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ Found ${improvementFindings.length} findings categorized as IMPROVEMENT\n`);

    // 2. Get all ImprovementOpportunity records
    console.log('📊 Step 2: Fetching all ImprovementOpportunity records...');
    const improvementOpportunities = await prisma.improvementOpportunity.findMany({
      select: {
        id: true,
        findingId: true,
        opportunity: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        observationRequirement: true,
        proposedAction: true,
        appropriatenessReview: true,
        followUpAction: true,
        actionEffectiveness: true,
        mrNotified: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ Found ${improvementOpportunities.length} ImprovementOpportunity records\n`);

    // 3. Create a map of finding IDs to improvement opportunities
    const improvementMap = new Map();
    improvementOpportunities.forEach(io => {
      improvementMap.set(io.findingId, io);
    });

    // 4. Analyze the findings
    console.log('📊 Step 3: Analyzing findings vs improvement opportunities...\n');
    
    const analysis = {
      totalImprovementFindings: improvementFindings.length,
      totalImprovementOpportunities: improvementOpportunities.length,
      findingsWithRecords: 0,
      findingsWithoutRecords: 0,
      orphanedRecords: 0,
      findingsWithIncompleteRecords: 0,
      findingsWithCompleteRecords: 0,
      findingsDetails: []
    };

    // Check each finding
    for (const finding of improvementFindings) {
      const improvementRecord = improvementMap.get(finding.id);
      
      if (improvementRecord) {
        analysis.findingsWithRecords++;
        
        // Check if record is complete (has basic required fields)
        const isComplete = improvementRecord.opportunity && 
                          improvementRecord.opportunity.trim() !== '' &&
                          improvementRecord.status;
        
        if (isComplete) {
          analysis.findingsWithCompleteRecords++;
        } else {
          analysis.findingsWithIncompleteRecords++;
        }
        
        analysis.findingsDetails.push({
          findingId: finding.id,
          findingTitle: finding.title,
          department: finding.department,
          hasRecord: true,
          recordComplete: isComplete,
          recordId: improvementRecord.id,
          recordStatus: improvementRecord.status,
          recordOpportunity: improvementRecord.opportunity,
          findingCreatedAt: finding.createdAt,
          recordCreatedAt: improvementRecord.createdAt,
          auditInfo: {
            auditNo: finding.audit.auditNo,
            programTitle: finding.audit.auditProgram.title,
            tenantName: finding.audit.auditProgram.tenant.name
          }
        });
      } else {
        analysis.findingsWithoutRecords++;
        analysis.findingsDetails.push({
          findingId: finding.id,
          findingTitle: finding.title,
          department: finding.department,
          hasRecord: false,
          recordComplete: false,
          recordId: null,
          recordStatus: null,
          recordOpportunity: null,
          findingCreatedAt: finding.createdAt,
          recordCreatedAt: null,
          auditInfo: {
            auditNo: finding.audit.auditNo,
            programTitle: finding.audit.auditProgram.title,
            tenantName: finding.audit.auditProgram.tenant.name
          }
        });
      }
    }

    // Check for orphaned records (improvement opportunities without corresponding findings)
    const findingIds = new Set(improvementFindings.map(f => f.id));
    for (const io of improvementOpportunities) {
      if (!findingIds.has(io.findingId)) {
        analysis.orphanedRecords++;
      }
    }

    // 5. Print summary
    console.log('📋 AUDIT SUMMARY:');
    console.log('================');
    console.log(`Total findings categorized as IMPROVEMENT: ${analysis.totalImprovementFindings}`);
    console.log(`Total ImprovementOpportunity records: ${analysis.totalImprovementOpportunities}`);
    console.log(`Findings WITH improvement records: ${analysis.findingsWithRecords}`);
    console.log(`Findings WITHOUT improvement records: ${analysis.findingsWithoutRecords}`);
    console.log(`Findings with COMPLETE records: ${analysis.findingsWithCompleteRecords}`);
    console.log(`Findings with INCOMPLETE records: ${analysis.findingsWithIncompleteRecords}`);
    console.log(`Orphaned improvement records: ${analysis.orphanedRecords}`);
    console.log('');

    // 6. Print detailed findings without records
    if (analysis.findingsWithoutRecords > 0) {
      console.log('🚨 FINDINGS WITHOUT IMPROVEMENT RECORDS:');
      console.log('========================================');
      analysis.findingsDetails
        .filter(f => !f.hasRecord)
        .forEach((finding, index) => {
          console.log(`${index + 1}. Finding ID: ${finding.findingId}`);
          console.log(`   Title: ${finding.findingTitle}`);
          console.log(`   Department: ${finding.department}`);
          console.log(`   Created: ${finding.findingCreatedAt.toISOString()}`);
          console.log(`   Audit: ${finding.auditInfo.auditNo} - ${finding.auditInfo.programTitle}`);
          console.log(`   Tenant: ${finding.auditInfo.tenantName}`);
          console.log('');
        });
    }

    // 7. Print findings with incomplete records
    if (analysis.findingsWithIncompleteRecords > 0) {
      console.log('⚠️ FINDINGS WITH INCOMPLETE IMPROVEMENT RECORDS:');
      console.log('================================================');
      analysis.findingsDetails
        .filter(f => f.hasRecord && !f.recordComplete)
        .forEach((finding, index) => {
          console.log(`${index + 1}. Finding ID: ${finding.findingId}`);
          console.log(`   Title: ${finding.findingTitle}`);
          console.log(`   Department: ${finding.department}`);
          console.log(`   Record ID: ${finding.recordId}`);
          console.log(`   Record Status: ${finding.recordStatus}`);
          console.log(`   Opportunity: ${finding.recordOpportunity || 'NULL/EMPTY'}`);
          console.log(`   Finding Created: ${finding.findingCreatedAt.toISOString()}`);
          console.log(`   Record Created: ${finding.recordCreatedAt.toISOString()}`);
          console.log('');
        });
    }

    // 8. Print orphaned records
    if (analysis.orphanedRecords > 0) {
      console.log('🔍 ORPHANED IMPROVEMENT RECORDS:');
      console.log('================================');
      improvementOpportunities
        .filter(io => !findingIds.has(io.findingId))
        .forEach((io, index) => {
          console.log(`${index + 1}. Record ID: ${io.id}`);
          console.log(`   Finding ID: ${io.findingId} (NOT FOUND)`);
          console.log(`   Status: ${io.status}`);
          console.log(`   Created: ${io.createdAt.toISOString()}`);
          console.log('');
        });
    }

    // 9. Generate recommendations
    console.log('💡 RECOMMENDATIONS:');
    console.log('===================');
    
    if (analysis.findingsWithoutRecords > 0) {
      console.log(`• ${analysis.findingsWithoutRecords} findings need ImprovementOpportunity records created`);
      console.log('• Consider running a fix script to create missing records');
    }
    
    if (analysis.findingsWithIncompleteRecords > 0) {
      console.log(`• ${analysis.findingsWithIncompleteRecords} findings have incomplete ImprovementOpportunity records`);
      console.log('• Consider updating these records with proper opportunity descriptions');
    }
    
    if (analysis.orphanedRecords > 0) {
      console.log(`• ${analysis.orphanedRecords} orphaned ImprovementOpportunity records found`);
      console.log('• Consider cleaning up these orphaned records');
    }
    
    if (analysis.findingsWithoutRecords === 0 && analysis.findingsWithIncompleteRecords === 0 && analysis.orphanedRecords === 0) {
      console.log('• All ImprovementOpportunity records are in good condition! 🎉');
    }

    console.log('\n✅ Audit completed successfully!');

    return analysis;

  } catch (error) {
    console.error('❌ Audit failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the audit if this script is executed directly
if (require.main === module) {
  auditImprovementOpportunityRecords()
    .then(() => {
      console.log('\n🏁 Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { auditImprovementOpportunityRecords }; 