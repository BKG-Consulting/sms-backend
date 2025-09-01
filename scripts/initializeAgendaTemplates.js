/**
 * Initialize Default Agenda Templates
 * Creates default opening and closing meeting agenda templates for all tenants
 */

const { PrismaClient } = require('@prisma/client');
const agendaTemplateService = require('../src/services/agendaTemplateService');

const prisma = new PrismaClient();

async function initializeAgendaTemplates() {
  try {
    console.log('🔧 Starting agenda template initialization...');

    // Get all active tenants
    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'ACTIVE'
      },
      select: {
        id: true,
        name: true,
        domain: true
      }
    });

    console.log(`📋 Found ${tenants.length} active tenants`);

    let successCount = 0;
    let errorCount = 0;

    for (const tenant of tenants) {
      try {
        console.log(`\n🏢 Processing tenant: ${tenant.name} (${tenant.domain})`);
        
        // Check if templates already exist
        const existingTemplates = await prisma.agendaTemplate.findMany({
          where: {
            tenantId: tenant.id,
            type: {
              in: ['OPENING', 'CLOSING']
            },
            isActive: true
          }
        });

        if (existingTemplates.length > 0) {
          console.log(`✅ Templates already exist for ${tenant.name}, skipping...`);
          continue;
        }

        // Initialize default templates
        const templates = await agendaTemplateService.initializeDefaultTemplates(tenant.id);
        
        console.log(`✅ Created templates for ${tenant.name}:`, Object.keys(templates));
        successCount++;
        
      } catch (error) {
        console.error(`❌ Error creating templates for ${tenant.name}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`✅ Successfully processed: ${successCount} tenants`);
    console.log(`❌ Errors: ${errorCount} tenants`);
    
    if (errorCount === 0) {
      console.log('🎉 All agenda templates initialized successfully!');
    } else {
      console.log('⚠️ Some tenants had errors. Check the logs above.');
    }

  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  initializeAgendaTemplates()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeAgendaTemplates }; 