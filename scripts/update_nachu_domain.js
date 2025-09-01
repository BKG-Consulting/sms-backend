const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateNachuDomain() {
  console.log('🔄 UPDATING NACHU DOMAIN\n');

  try {
    // Find the tenant with the current domain
    const tenant = await prisma.tenant.findUnique({
      where: {
        domain: 'nachutvc.ac.ke'
      },
      select: {
        id: true,
        name: true,
        domain: true,
        email: true
      }
    });

    if (!tenant) {
      console.log('❌ Tenant with domain "nachutvc.ac.ke" not found');
      return;
    }

    console.log('📍 Found tenant:');
    console.log(`   Name: ${tenant.name}`);
    console.log(`   Current Domain: ${tenant.domain}`);
    console.log(`   Email: ${tenant.email}`);

    // Check if the new domain already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: {
        domain: 'nachu'
      }
    });

    if (existingTenant) {
      console.log('❌ Domain "nachu" already exists for another tenant');
      console.log(`   Existing tenant: ${existingTenant.name} (${existingTenant.id})`);
      return;
    }

    // Update the domain
    console.log('\n🔄 Updating domain from "nachutvc.ac.ke" to "nachu"...');
    
    const updatedTenant = await prisma.tenant.update({
      where: {
        id: tenant.id
      },
      data: {
        domain: 'nachu'
      },
      select: {
        id: true,
        name: true,
        domain: true,
        email: true,
        updatedAt: true
      }
    });

    console.log('✅ Domain updated successfully!');
    console.log('📍 Updated tenant details:');
    console.log(`   Name: ${updatedTenant.name}`);
    console.log(`   New Domain: ${updatedTenant.domain}`);
    console.log(`   Email: ${updatedTenant.email}`);
    console.log(`   Updated At: ${updatedTenant.updatedAt}`);

    // Verify the update
    console.log('\n🔍 Verifying the update...');
    const verification = await prisma.tenant.findUnique({
      where: {
        domain: 'nachu'
      },
      select: {
        id: true,
        name: true,
        domain: true
      }
    });

    if (verification && verification.id === tenant.id) {
      console.log('✅ Verification successful! Domain change confirmed.');
    } else {
      console.log('❌ Verification failed! Domain change not confirmed.');
    }

    // Check that old domain no longer exists
    const oldDomainCheck = await prisma.tenant.findUnique({
      where: {
        domain: 'nachutvc.ac.ke'
      }
    });

    if (!oldDomainCheck) {
      console.log('✅ Old domain "nachutvc.ac.ke" no longer exists - good!');
    } else {
      console.log('❌ Old domain still exists - this should not happen!');
    }

  } catch (error) {
    console.error('❌ Error updating domain:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateNachuDomain(); 