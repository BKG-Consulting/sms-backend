#!/usr/bin/env node

const { prisma } = require('../prisma/client');

async function checkFindingsCategorization() {
  console.log('🔍 [FINDINGS_CHECK] Checking existing findings categorization...\n');
  
  try {
    // Get all findings with their categorization status
    const findings = await prisma.auditFinding.findMany({
      include: {
        nonConformities: true,
        improvements: true,
        compliance: true,
        audit: {
          include: {
            auditProgram: {
              select: { title: true, tenantId: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 [FINDINGS_CHECK] Found ${findings.length} total findings\n`);

    // Categorize findings by their category
    const categorized = {
      COMPLIANCE: [],
      IMPROVEMENT: [],
      NON_CONFORMITY: [],
      UNCATEGORIZED: []
    };

    findings.forEach(finding => {
      if (finding.category) {
        categorized[finding.category].push(finding);
      } else {
        categorized.UNCATEGORIZED.push(finding);
      }
    });

    // Display summary
    console.log('📋 [FINDINGS_CHECK] Categorization Summary:');
    console.log(`   COMPLIANCE: ${categorized.COMPLIANCE.length} findings`);
    console.log(`   IMPROVEMENT: ${categorized.IMPROVEMENT.length} findings`);
    console.log(`   NON_CONFORMITY: ${categorized.NON_CONFORMITY.length} findings`);
    console.log(`   UNCATEGORIZED: ${categorized.UNCATEGORIZED.length} findings\n`);

    // Check IMPROVEMENT findings specifically
    console.log('🔍 [FINDINGS_CHECK] IMPROVEMENT Findings Analysis:');
    if (categorized.IMPROVEMENT.length === 0) {
      console.log('   ❌ No IMPROVEMENT findings found');
    } else {
      categorized.IMPROVEMENT.forEach((finding, index) => {
        console.log(`   ${index + 1}. Finding: "${finding.title}"`);
        console.log(`      ID: ${finding.id}`);
        console.log(`      Status: ${finding.status}`);
        console.log(`      Has ImprovementOpportunity: ${!!finding.improvements}`);
        console.log(`      Has NonConformity: ${!!finding.nonConformities?.length}`);
        console.log(`      Has Compliance: ${!!finding.compliance}`);
        
        if (finding.improvements) {
          console.log(`      ImprovementOpportunity ID: ${finding.improvements.id}`);
          console.log(`      ImprovementOpportunity Status: ${finding.improvements.status}`);
          console.log(`      Opportunity: ${finding.improvements.opportunity}`);
        } else {
          console.log(`      ⚠️  WARNING: No ImprovementOpportunity record found!`);
        }
        console.log('');
      });
    }

    // Check NON_CONFORMITY findings
    console.log('🔍 [FINDINGS_CHECK] NON_CONFORMITY Findings Analysis:');
    if (categorized.NON_CONFORMITY.length === 0) {
      console.log('   ❌ No NON_CONFORMITY findings found');
    } else {
      categorized.NON_CONFORMITY.forEach((finding, index) => {
        console.log(`   ${index + 1}. Finding: "${finding.title}"`);
        console.log(`      ID: ${finding.id}`);
        console.log(`      Status: ${finding.status}`);
        console.log(`      Has NonConformity: ${!!finding.nonConformities?.length}`);
        console.log(`      Has ImprovementOpportunity: ${!!finding.improvements}`);
        console.log(`      Has Compliance: ${!!finding.compliance}`);
        
        if (finding.nonConformities?.length > 0) {
          const nonConformity = finding.nonConformities[0];
          console.log(`      NonConformity ID: ${nonConformity.id}`);
          console.log(`      NonConformity Type: ${nonConformity.type}`);
          console.log(`      NonConformity Severity: ${nonConformity.severity}`);
          console.log(`      NonConformity Status: ${nonConformity.status}`);
        } else {
          console.log(`      ⚠️  WARNING: No NonConformity record found!`);
        }
        console.log('');
      });
    }

    // Check COMPLIANCE findings
    console.log('🔍 [FINDINGS_CHECK] COMPLIANCE Findings Analysis:');
    if (categorized.COMPLIANCE.length === 0) {
      console.log('   ❌ No COMPLIANCE findings found');
    } else {
      categorized.COMPLIANCE.forEach((finding, index) => {
        console.log(`   ${index + 1}. Finding: "${finding.title}"`);
        console.log(`      ID: ${finding.id}`);
        console.log(`      Status: ${finding.status}`);
        console.log(`      Has Compliance: ${!!finding.compliance}`);
        console.log(`      Has NonConformity: ${!!finding.nonConformities?.length}`);
        console.log(`      Has ImprovementOpportunity: ${!!finding.improvements}`);
        
        if (finding.compliance) {
          console.log(`      Compliance ID: ${finding.compliance.id}`);
          console.log(`      Compliance Status: ${finding.compliance.status}`);
        } else {
          console.log(`      ⚠️  WARNING: No ComplianceRecord found!`);
        }
        console.log('');
      });
    }

    // Check for findings with missing records
    console.log('🔍 [FINDINGS_CHECK] Findings with Missing Records:');
    const findingsWithIssues = findings.filter(finding => {
      if (finding.category === 'IMPROVEMENT' && !finding.improvements) return true;
      if (finding.category === 'NON_CONFORMITY' && !finding.nonConformities?.length) return true;
      if (finding.category === 'COMPLIANCE' && !finding.compliance) return true;
      return false;
    });

    if (findingsWithIssues.length === 0) {
      console.log('   ✅ All categorized findings have their appropriate records');
    } else {
      console.log(`   ⚠️  Found ${findingsWithIssues.length} findings with missing records:`);
      findingsWithIssues.forEach(finding => {
        console.log(`      - "${finding.title}" (${finding.category})`);
        if (finding.category === 'IMPROVEMENT' && !finding.improvements) {
          console.log(`        Missing: ImprovementOpportunity`);
        }
        if (finding.category === 'NON_CONFORMITY' && !finding.nonConformities?.length) {
          console.log(`        Missing: NonConformity`);
        }
        if (finding.category === 'COMPLIANCE' && !finding.compliance) {
          console.log(`        Missing: ComplianceRecord`);
        }
      });
    }

    // Summary
    console.log('\n📊 [FINDINGS_CHECK] Summary:');
    console.log(`   Total Findings: ${findings.length}`);
    console.log(`   Properly Categorized: ${findings.length - categorized.UNCATEGORIZED.length}`);
    console.log(`   Uncategorized: ${categorized.UNCATEGORIZED.length}`);
    console.log(`   Findings with Issues: ${findingsWithIssues.length}`);

    if (findingsWithIssues.length > 0) {
      console.log('\n⚠️  [FINDINGS_CHECK] RECOMMENDATIONS:');
      console.log('   1. Check if the categorization logic is working properly');
      console.log('   2. Verify that the updateFinding function is being called');
      console.log('   3. Check for any database transaction issues');
      console.log('   4. Consider re-categorizing findings with missing records');
    } else {
      console.log('\n✅ [FINDINGS_CHECK] All findings are properly categorized!');
    }

  } catch (error) {
    console.error('❌ [FINDINGS_CHECK] Check failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFindingsCategorization()
  .then(() => {
    console.log('\n🎉 [FINDINGS_CHECK] Check completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 [FINDINGS_CHECK] Check failed:', error);
    process.exit(1);
  }); 