const { prisma } = require('../prisma/client');

async function exploreAuditProgramSchema() {
  console.log('=== EXPLORING AUDIT PROGRAM SCHEMA ===\n');

  try {
    // 1. Get RTVC tenant first
    const rtvcTenant = await prisma.tenant.findFirst({
      where: { 
        name: { contains: 'Runyenjes Technical and Vocational College' }
      }
    });

    if (!rtvcTenant) {
      console.log('❌ RTVC tenant not found');
      return;
    }

    console.log(`📍 RTVC Tenant: ${rtvcTenant.name} (${rtvcTenant.id})`);

    // 2. Try to find any audit programs to see the available fields and status values
    console.log('\n1️⃣ CHECKING ALL AUDIT PROGRAMS FOR RTVC:');
    
    const allPrograms = await prisma.auditProgram.findMany({
      where: { tenantId: rtvcTenant.id },
      take: 5, // Just get a few to examine
      orderBy: { createdAt: 'desc' }
    });

    if (allPrograms.length === 0) {
      console.log('ℹ️  No audit programs found for RTVC');
      
      // Let's check if there are any audit programs in the system at all
      const anyPrograms = await prisma.auditProgram.findMany({
        take: 5,
        include: {
          tenant: { select: { name: true } }
        }
      });
      
      if (anyPrograms.length > 0) {
        console.log('\n📋 Found audit programs in other tenants:');
        anyPrograms.forEach(program => {
          console.log(`   Tenant: ${program.tenant.name}`);
          console.log(`   Status: ${program.status}`);
          console.log(`   Title: ${program.title || 'No title'}`);
          console.log(`   ID: ${program.id}\n`);
        });
      } else {
        console.log('\nℹ️  No audit programs found in the entire system');
      }
    } else {
      console.log(`✅ Found ${allPrograms.length} audit program(s) for RTVC:\n`);
      
      allPrograms.forEach((program, index) => {
        console.log(`📋 Program ${index + 1}:`);
        console.log(`   ID: ${program.id}`);
        console.log(`   Title: ${program.title || 'No title'}`);
        console.log(`   Status: ${program.status}`);
        console.log(`   Created: ${program.createdAt?.toISOString().split('T')[0] || 'Unknown'}`);
        console.log(`   Description: ${program.description || 'No description'}`);
        console.log('');
      });
    }

    // 3. Let's also check what statuses are actually being used across all programs
    console.log('\n2️⃣ CHECKING ALL POSSIBLE STATUS VALUES:');
    
    const statusCounts = await prisma.auditProgram.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    if (statusCounts.length > 0) {
      console.log('✅ Found the following status values in use:');
      statusCounts.forEach(({ status, _count }) => {
        console.log(`   "${status}": ${_count.status} program(s)`);
      });
    } else {
      console.log('ℹ️  No audit programs found in the system');
    }

  } catch (error) {
    console.error('❌ Error exploring schema:', error.message);
    console.error('Full error:', error);
    throw error;
  }
}

exploreAuditProgramSchema()
  .then(() => {
    console.log('\n=== SCHEMA EXPLORATION COMPLETE ===');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Exploration failed:', error);
    process.exit(1);
  });
