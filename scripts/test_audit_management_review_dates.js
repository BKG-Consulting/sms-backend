// Test script to check if getAuditById returns management review dates
const { prisma } = require('../prisma/client');

async function testAuditManagementReviewDates() {
  try {
    console.log('🔍 Testing getAuditById for management review dates...');
    
    // Get a sample audit
    const audit = await prisma.audit.findFirst({
      include: {
        auditProgram: { select: { id: true, title: true, status: true } },
        teamMembers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        }
      }
    });
    
    if (!audit) {
      console.log('❌ No audit found in database');
      return;
    }
    
    console.log('✅ Found audit:', {
      id: audit.id,
      type: audit.type,
      managementReviewDateFrom: audit.managementReviewDateFrom,
      managementReviewDateTo: audit.managementReviewDateTo,
      hasManagementReviewDates: !!(audit.managementReviewDateFrom && audit.managementReviewDateTo),
      allFields: Object.keys(audit)
    });
    
    // Check if management review dates exist in the database
    const auditsWithMRDates = await prisma.audit.findMany({
      where: {
        OR: [
          { managementReviewDateFrom: { not: null } },
          { managementReviewDateTo: { not: null } }
        ]
      },
      select: {
        id: true,
        type: true,
        managementReviewDateFrom: true,
        managementReviewDateTo: true
      }
    });
    
    console.log(`📊 Found ${auditsWithMRDates.length} audits with management review dates:`);
    auditsWithMRDates.forEach(audit => {
      console.log(`  - ${audit.id} (${audit.type}): ${audit.managementReviewDateFrom} to ${audit.managementReviewDateTo}`);
    });
    
  } catch (error) {
    console.error('❌ Error testing audit management review dates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuditManagementReviewDates(); 