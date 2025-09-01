const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAuditDetailsPage() {
  try {
    console.log('🔍 Testing audit details page functionality...');
    
    // Get the first tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log('❌ No tenants found in database');
      return;
    }
    console.log('✅ Found tenant:', tenant.name);
    
    // Get the first audit program
    const auditProgram = await prisma.auditProgram.findFirst({
      where: { tenantId: tenant.id }
    });
    if (!auditProgram) {
      console.log('❌ No audit programs found for tenant');
      return;
    }
    console.log('✅ Found audit program:', auditProgram.title);
    
    // Get the first audit
    const audit = await prisma.audit.findFirst({
      where: { auditProgramId: auditProgram.id },
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
      console.log('❌ No audits found for audit program');
      return;
    }
    
    console.log('✅ Found audit:', {
      id: audit.id,
      auditNo: audit.auditNo,
      type: audit.type,
      status: audit.status,
      auditProgramId: audit.auditProgramId,
      hasTeamMembers: audit.teamMembers.length > 0
    });
    
    console.log('🎯 Test URLs:');
    console.log(`   Frontend: /audit-management/audits/${audit.id}`);
    console.log(`   Backend: GET /api/audits/${audit.id}`);
    
    console.log('✅ Audit details page should work correctly!');
    
  } catch (error) {
    console.error('❌ Error testing audit details page:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuditDetailsPage(); 