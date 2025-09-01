const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const program = await prisma.auditProgram.findUnique({
      where: { id: 'd3bf0cf4-61b8-45fe-82fb-1460125be552' },
      select: { title: true, status: true, committedAt: true }
    });
    
    console.log('AUDIT PROGRAM STATUS:');
    console.log(`Title: ${program?.title || 'NOT FOUND'}`);
    console.log(`Status: ${program?.status || 'NOT FOUND'}`);
    console.log(`Committed: ${program?.committedAt || 'NULL'}`);
    
    if (program?.status === 'DRAFT' && !program?.committedAt) {
      console.log('✅ SUCCESS: Program is ready for testing!');
    } else {
      console.log('❌ ISSUE: Program still needs to be reverted');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
})();
