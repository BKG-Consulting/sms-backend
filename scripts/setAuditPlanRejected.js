// scripts/setAuditPlanRejected.js
// Usage: node setAuditPlanRejected.js <auditPlanId>

const { prisma } = require('../prisma/client');

async function setAuditPlanRejected(auditPlanId) {
  if (!auditPlanId) {
    console.error('Usage: node setAuditPlanRejected.js <auditPlanId>');
    process.exit(1);
  }
  try {
    const updated = await prisma.auditPlan.update({
      where: { id: auditPlanId },
      data: { status: 'REJECTED' },
    });
    console.log('Audit plan status updated to REJECTED:', updated.id);
  } catch (err) {
    console.error('Error updating audit plan:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setAuditPlanRejected(process.argv[2]);
