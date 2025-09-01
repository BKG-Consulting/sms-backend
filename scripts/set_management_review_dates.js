// Script to set management review dates for audits
const { prisma } = require('../prisma/client');

async function setManagementReviewDates() {
  try {
    console.log('🔍 Finding audits without management review dates...');
    
    // Get all audits
    const audits = await prisma.audit.findMany({
      select: {
        id: true,
        type: true,
        auditDateFrom: true,
        auditDateTo: true,
        managementReviewDateFrom: true,
        managementReviewDateTo: true
      }
    });
    
    console.log(`📊 Found ${audits.length} total audits`);
    
    const auditsWithoutMRDates = audits.filter(audit => 
      !audit.managementReviewDateFrom || !audit.managementReviewDateTo
    );
    
    console.log(`📊 Found ${auditsWithoutMRDates.length} audits without management review dates:`);
    
    if (auditsWithoutMRDates.length === 0) {
      console.log('✅ All audits already have management review dates set');
      return;
    }
    
    // Set management review dates for each audit
    for (const audit of auditsWithoutMRDates) {
      // Set MR dates to be 2 weeks after the audit end date, or 1 month from now if no audit end date
      let mrDateFrom, mrDateTo;
      
      if (audit.auditDateTo) {
        // Set MR dates 2 weeks after audit end
        const auditEndDate = new Date(audit.auditDateTo);
        mrDateFrom = new Date(auditEndDate.getTime() + (14 * 24 * 60 * 60 * 1000)); // +14 days
        mrDateTo = new Date(mrDateFrom.getTime() + (2 * 24 * 60 * 60 * 1000)); // +2 days for MR period
      } else {
        // Set MR dates 1 month from now
        const now = new Date();
        mrDateFrom = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // +30 days
        mrDateTo = new Date(mrDateFrom.getTime() + (2 * 24 * 60 * 60 * 1000)); // +2 days
      }
      
      console.log(`📅 Setting MR dates for audit ${audit.id} (${audit.type}):`);
      console.log(`   From: ${mrDateFrom.toISOString().split('T')[0]}`);
      console.log(`   To: ${mrDateTo.toISOString().split('T')[0]}`);
      
      await prisma.audit.update({
        where: { id: audit.id },
        data: {
          managementReviewDateFrom: mrDateFrom,
          managementReviewDateTo: mrDateTo
        }
      });
      
      console.log(`✅ Updated audit ${audit.id}`);
    }
    
    console.log('🎉 Successfully set management review dates for all audits!');
    
  } catch (error) {
    console.error('❌ Error setting management review dates:', error);
  } finally {
    await prisma.$disconnect();
  }
}

setManagementReviewDates(); 