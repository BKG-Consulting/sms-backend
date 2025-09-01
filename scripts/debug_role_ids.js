#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugRoleIds() {
  try {
    console.log('🔍 Debugging Role IDs...\n');

    // From the JWT token debug logs:
    const jwtMRRoleId = '5e150f95-65ec-4b07-ab3b-db72efc1eed0';
    const jwtStaffRoleId = 'e5268c07-b81e-4acb-8bce-f6582256f35e';

    console.log('JWT Token Role IDs:');
    console.log('  MR Role ID:', jwtMRRoleId);
    console.log('  STAFF Role ID:', jwtStaffRoleId);
    console.log('');

    // Check database role IDs
    const mrRole = await prisma.role.findFirst({
      where: { name: 'MR' }
    });

    const staffRole = await prisma.role.findFirst({
      where: { name: 'STAFF' }
    });

    console.log('Database Role IDs:');
    console.log('  MR Role ID:', mrRole?.id);
    console.log('  STAFF Role ID:', staffRole?.id);
    console.log('');

    // Check if they match
    console.log('Role ID Comparison:');
    console.log('  MR Role ID Match:', mrRole?.id === jwtMRRoleId ? '✅' : '❌');
    console.log('  STAFF Role ID Match:', staffRole?.id === jwtStaffRoleId ? '✅' : '❌');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugRoleIds(); 