const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugAuditProgramStatus() {
  try {
    console.log('🔍 Debugging audit program status...');
    
    const programId = 'c55cbeb6-c79b-4804-a28c-6c96bbc92ac7';
    const tenantId = 'e4ac3039-43bf-4979-9659-b62ff26939d0';
    
    // Get the audit program from database
    const auditProgram = await prisma.auditProgram.findFirst({
      where: {
        id: programId,
        tenantId
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            audits: true
          }
        }
      }
    });
    
    if (!auditProgram) {
      console.log('❌ Audit program not found');
      return;
    }
    
    console.log('📋 Audit program details:');
    console.log(`   ID: ${auditProgram.id}`);
    console.log(`   Title: ${auditProgram.title}`);
    console.log(`   Status: "${auditProgram.status}"`);
    console.log(`   Status length: ${auditProgram.status.length}`);
    console.log(`   Status char codes: ${Array.from(auditProgram.status).map(c => c.charCodeAt(0)).join(', ')}`);
    console.log(`   Created: ${auditProgram.createdAt}`);
    console.log(`   Updated: ${auditProgram.updatedAt}`);
    console.log(`   Audit count: ${auditProgram._count.audits}`);
    
    // Check if status matches expected values
    const expectedStatuses = ['DRAFT', 'draft', 'Draft'];
    const statusMatch = expectedStatuses.find(s => s === auditProgram.status);
    
    if (statusMatch) {
      console.log(`✅ Status matches expected: "${statusMatch}"`);
    } else {
      console.log(`❌ Status does not match any expected values`);
      console.log(`   Expected: ${expectedStatuses.join(', ')}`);
      console.log(`   Actual: "${auditProgram.status}"`);
    }
    
    // Check the validation logic
    const isDraft = auditProgram.status === 'DRAFT';
    console.log(`\n🔍 Validation check: auditProgram.status === 'DRAFT' = ${isDraft}`);
    
    if (!isDraft) {
      console.log('❌ This explains why the commit is failing!');
    } else {
      console.log('✅ Status should allow commit - there might be another issue');
    }
    
  } catch (error) {
    console.error('❌ Error debugging audit program status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAuditProgramStatus(); 