const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Predefined closing meeting agendas
const CLOSING_MEETING_AGENDAS = [
  {
    agendaText: "Introduction and Registration",
    isRequired: true
  },
  {
    agendaText: "Thanking the Auditee",
    isRequired: true
  },
  {
    agendaText: "Reconfirmation audit Objectives and scope and criteria",
    isRequired: true
  },
  {
    agendaText: "Mention of principles of sampling followed in auditing",
    isRequired: true
  },
  {
    agendaText: "Presentation of the findings - summary Positives, Observation and nonconformities in detail",
    isRequired: true
  },
  {
    agendaText: "Presentation of conclusion and opinion",
    isRequired: true
  },
  {
    agendaText: "Discussion on the findings",
    isRequired: true
  },
  {
    agendaText: "Corrective action dates",
    isRequired: true
  },
  {
    agendaText: "Follow up dates",
    isRequired: true
  },
  {
    agendaText: "Reconfirmation of confidentiality",
    isRequired: true
  }
];

async function createClosingMeetingAgendaTemplate() {
  try {
    console.log('🚀 Starting to create closing meeting agenda template...');
    
    // Get all tenants
    const tenants = await prisma.tenant.findMany({
      where: {
        status: 'ACTIVE'
      }
    });

    if (tenants.length === 0) {
      console.error('❌ No active tenants found');
      return;
    }

    console.log(`✅ Found ${tenants.length} active tenants`);

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const tenant of tenants) {
      console.log(`\n📋 Processing tenant: ${tenant.name} (${tenant.id})`);
      
      // Check if CLOSING template already exists for this tenant
      const existingTemplate = await prisma.agendaTemplate.findFirst({
        where: {
          type: 'CLOSING',
          tenantId: tenant.id,
          isActive: true
        }
      });

      if (existingTemplate) {
        console.log(`⏭️  Skipping tenant ${tenant.name} - CLOSING template already exists`);
        totalSkipped++;
        continue;
      }

      // Create the CLOSING agenda template
      const template = await prisma.agendaTemplate.create({
        data: {
          type: 'CLOSING',
          tenantId: tenant.id,
          name: 'Closing Meeting Agenda Template',
          isActive: true,
          items: {
            create: CLOSING_MEETING_AGENDAS.map((item, index) => ({
              agendaText: item.agendaText,
              order: index + 1,
              isRequired: item.isRequired
            }))
          }
        },
        include: {
          items: {
            orderBy: {
              order: 'asc'
            }
          }
        }
      });

      console.log(`✅ Created CLOSING template for tenant ${tenant.name} with ${template.items.length} items`);
      totalCreated++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${totalCreated} templates`);
    console.log(`   Skipped: ${totalSkipped} templates (already existed)`);
    console.log(`   Total processed: ${tenants.length}`);

    if (totalCreated > 0) {
      console.log('\n🔧 Next steps:');
      console.log('   1. Test the closing meeting creation functionality');
      console.log('   2. Verify that closing meetings can now be created successfully');
    }

  } catch (error) {
    console.error('❌ Error creating closing meeting agenda template:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createClosingMeetingAgendaTemplate(); 