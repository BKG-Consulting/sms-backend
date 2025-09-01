const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCategorization() {
  console.log('🔍 Testing Categorization Logic and Data Consistency');
  
  try {
    // 1. Check findings with categories but missing related records
    console.log('\n📊 Checking findings consistency...');
    
    const findingsWithCategories = await prisma.auditFinding.findMany({
      where: {
        category: {
          not: null
        }
      },
      include: {
        nonConformities: true,
        compliance: true,
        improvements: true,
        createdBy: {
          select: { firstName: true, lastName: true }
        }
      }
    });
    
    console.log(`Found ${findingsWithCategories.length} categorized findings`);
    
    // Analyze each category
    let nonConformityFindings = 0;
    let complianceFindings = 0;
    let improvementFindings = 0;
    let missingRecords = [];
    
    for (const finding of findingsWithCategories) {
      const { category, id, title, nonConformities, compliance, improvements } = finding;
      
      if (category === 'NON_CONFORMITY') {
        nonConformityFindings++;
        if (!nonConformities || nonConformities.length === 0) {
          missingRecords.push({
            findingId: id,
            title,
            category,
            missing: 'NonConformity record'
          });
        }
      } else if (category === 'COMPLIANCE') {
        complianceFindings++;
        if (!compliance) {
          missingRecords.push({
            findingId: id,
            title,
            category,
            missing: 'ComplianceRecord'
          });
        }
      } else if (category === 'IMPROVEMENT') {
        improvementFindings++;
        if (!improvements) {
          missingRecords.push({
            findingId: id,
            title,
            category,
            missing: 'ImprovementOpportunity'
          });
        }
      }
    }
    
    console.log(`\n📈 Category Distribution:`);
    console.log(`  - NON_CONFORMITY: ${nonConformityFindings}`);
    console.log(`  - COMPLIANCE: ${complianceFindings}`);
    console.log(`  - IMPROVEMENT: ${improvementFindings}`);
    
    if (missingRecords.length > 0) {
      console.log(`\n⚠️  Found ${missingRecords.length} findings with missing related records:`);
      missingRecords.forEach(record => {
        console.log(`  - ${record.title} (${record.category}) missing ${record.missing}`);
      });
    } else {
      console.log(`\n✅ All categorized findings have corresponding records!`);
    }
    
    // 2. Test the enum values
    console.log('\n🔤 Testing enum values...');
    
    const enumTest = await prisma.$queryRaw`
      SELECT enumlabel as category 
      FROM pg_enum 
      WHERE enumtypid = (
        SELECT oid 
        FROM pg_type 
        WHERE typname = 'FindingCategory'
      )
    `;
    
    console.log('Available FindingCategory enum values:', enumTest.map(e => e.category));
    
    // 3. Check sample relationships
    console.log('\n🔗 Sample relationship data:');
    
    const sampleNonConformity = await prisma.nonConformity.findFirst({
      include: {
        finding: { select: { title: true, category: true } },
        correctiveActions: { select: { id: true, title: true } }
      }
    });
    
    if (sampleNonConformity) {
      console.log('Sample NonConformity:', {
        id: sampleNonConformity.id,
        findingTitle: sampleNonConformity.finding.title,
        findingCategory: sampleNonConformity.finding.category,
        correctiveActionsCount: sampleNonConformity.correctiveActions.length
      });
    }
    
    const sampleImprovement = await prisma.improvementOpportunity.findFirst({
      include: {
        finding: { select: { title: true, category: true } }
      }
    });
    
    if (sampleImprovement) {
      console.log('Sample ImprovementOpportunity:', {
        id: sampleImprovement.id,
        findingTitle: sampleImprovement.finding.title,
        findingCategory: sampleImprovement.finding.category
      });
    }
    
  } catch (error) {
    console.error('❌ Error testing categorization:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCategorization();
