const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFindingRetrieval() {
  console.log('🔍 Testing Finding Retrieval with Relations');
  
  try {
    // Test the exact query our frontend will use
    const findings = await prisma.auditFinding.findMany({
      where: { 
        auditId: "12c1e28d-8b38-45b3-992c-7a67c5bce29b" // Use a sample audit ID
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        criteria: true,
        createdAt: true,
        updatedAt: true,
        category: true,
        department: true,
        createdById: true,
        reviewed: true,
        nonConformities: {
          select: {
            id: true,
            title: true,
            type: true,
            severity: true,
            status: true
          }
        },
        improvements: {
          select: {
            id: true,
            opportunity: true,
            status: true
          }
        },
        compliance: {
          select: {
            id: true,
            status: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        audit: {
          select: {
            type: true,
            auditProgram: {
              select: {
                title: true
              }
            }
          }
        },
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n📊 Found ${findings.length} findings for audit`);
    
    findings.forEach((finding, index) => {
      console.log(`\n${index + 1}. ${finding.title} (${finding.category || 'No category'})`);
      console.log(`   Status: ${finding.status}`);
      console.log(`   Department: ${finding.department}`);
      
      if (finding.category === 'NON_CONFORMITY') {
        console.log(`   NonConformities: ${finding.nonConformities.length}`);
        finding.nonConformities.forEach(nc => {
          console.log(`     - ${nc.id} (${nc.type}/${nc.severity})`);
        });
      }
      
      if (finding.category === 'IMPROVEMENT') {
        console.log(`   ImprovementOpportunity: ${finding.improvements ? 'Yes' : 'No'}`);
        if (finding.improvements) {
          console.log(`     - ${finding.improvements.id} (${finding.improvements.status})`);
        }
      }
      
      if (finding.category === 'COMPLIANCE') {
        console.log(`   ComplianceRecord: ${finding.compliance ? 'Yes' : 'No'}`);
        if (finding.compliance) {
          console.log(`     - ${finding.compliance.id} (${finding.compliance.status})`);
        }
      }
    });
    
    // Test specific scenarios for workflow buttons
    console.log('\n🎯 Workflow Button Scenarios:');
    
    const acceptedNonConformities = findings.filter(f => 
      f.status === 'ACCEPTED' && f.category === 'NON_CONFORMITY'
    );
    console.log(`Accepted NON_CONFORMITY findings: ${acceptedNonConformities.length}`);
    
    const acceptedImprovements = findings.filter(f => 
      f.status === 'ACCEPTED' && f.category === 'IMPROVEMENT'
    );
    console.log(`Accepted IMPROVEMENT findings: ${acceptedImprovements.length}`);
    
    // Test the specific logic our frontend will use
    if (acceptedNonConformities.length > 0) {
      const sample = acceptedNonConformities[0];
      console.log(`\n✅ Sample corrective action button logic:`);
      console.log(`   Finding: ${sample.title}`);
      console.log(`   Has nonConformities: ${!!(sample.nonConformities && sample.nonConformities.length > 0)}`);
      if (sample.nonConformities && sample.nonConformities.length > 0) {
        console.log(`   NonConformity ID: ${sample.nonConformities[0].id}`);
        console.log(`   ✅ Would navigate to: /auditors/corrective-actions/${sample.nonConformities[0].id}`);
      }
    }
    
    if (acceptedImprovements.length > 0) {
      const sample = acceptedImprovements[0];
      console.log(`\n✅ Sample preventive action button logic:`);
      console.log(`   Finding: ${sample.title}`);
      console.log(`   Has improvements: ${!!sample.improvements}`);
      if (sample.improvements) {
        console.log(`   Improvement ID: ${sample.improvements.id}`);
        console.log(`   ✅ Would navigate to: /auditors/preventive-actions/${sample.improvements.id}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing finding retrieval:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testFindingRetrieval();
