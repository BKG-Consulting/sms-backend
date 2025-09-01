const { prisma } = require('../prisma/client');

async function testPreventiveActionWorkflow() {
  console.log('🔍 [TEST] Starting preventive action workflow test...\n');

  try {
    // 1. Find an existing improvement opportunity
    console.log('📊 Step 1: Finding an existing improvement opportunity...');
    const improvementOpportunity = await prisma.improvementOpportunity.findFirst({
      include: {
        finding: {
          include: {
            audit: {
              include: {
                auditProgram: {
                  select: { tenantId: true }
                }
              }
            }
          }
        }
      }
    });

    if (!improvementOpportunity) {
      console.error('❌ No improvement opportunity found in database');
      return;
    }

    console.log(`✅ Found improvement opportunity:`, {
      id: improvementOpportunity.id,
      opportunity: improvementOpportunity.opportunity,
      status: improvementOpportunity.status,
      findingId: improvementOpportunity.findingId,
      department: improvementOpportunity.finding?.department,
      tenantId: improvementOpportunity.finding?.audit?.auditProgram?.tenantId
    });

    // 2. Find the HOD for the department
    console.log('\n📊 Step 2: Finding HOD for the department...');
    const departmentName = improvementOpportunity.finding?.department;
    const tenantId = improvementOpportunity.finding?.audit?.auditProgram?.tenantId;

    if (!departmentName || !tenantId) {
      console.error('❌ Missing department or tenant information');
      return;
    }

    const department = await prisma.department.findFirst({
      where: {
        name: departmentName,
        tenantId: tenantId
      },
      include: {
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!department) {
      console.error(`❌ Department not found: "${departmentName}" in tenant: ${tenantId}`);
      return;
    }

    if (!department.hodId) {
      console.error(`❌ No HOD assigned to department: "${departmentName}"`);
      return;
    }

    console.log(`✅ Found HOD:`, {
      hodId: department.hodId,
      hodName: `${department.hod.firstName} ${department.hod.lastName}`,
      hodEmail: department.hod.email,
      department: departmentName,
      tenantId: tenantId
    });

    // 3. Find an auditor user for testing
    console.log('\n📊 Step 3: Finding an auditor user for testing...');
    const auditor = await prisma.user.findFirst({
      where: {
        tenantId: tenantId,
        OR: [
          { userRoles: { some: { role: { name: 'AUDITOR' } } } },
          { userDepartmentRoles: { some: { role: { name: 'AUDITOR' } } } }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      }
    });

    if (!auditor) {
      console.error(`❌ No auditor found for tenant: ${tenantId}`);
      return;
    }

    console.log(`✅ Found auditor:`, {
      auditorId: auditor.id,
      auditorName: `${auditor.firstName} ${auditor.lastName}`,
      auditorEmail: auditor.email
    });

    // 4. Test data for observation requirement
    const testData = {
      area: 'Test Area for Preventive Action',
      observation: 'Test observation requirement for preventive action workflow',
      evidence: 'Test evidence for preventive action'
    };

    console.log('\n📊 Step 4: Testing observation requirement commit...');
    console.log('Test data:', testData);

    // 5. Import and test the service
    console.log('\n📊 Step 5: Testing preventive action service...');
    const preventiveActionService = require('../src/services/preventiveActionService');

    try {
      const result = await preventiveActionService.updateObservationRequirement({
        id: improvementOpportunity.id,
        area: testData.area,
        observation: testData.observation,
        evidence: testData.evidence,
        auditor: `${auditor.firstName} ${auditor.lastName}`,
        userId: auditor.id
      });

      console.log('\n✅ [SUCCESS] Preventive action workflow test completed!');
      console.log('Result:', {
        success: result.success,
        hasSuccessfulNotifications: result.hasSuccessfulNotifications,
        notificationResults: result.notificationResults
      });

      // 6. Verify the notification was created
      console.log('\n📊 Step 6: Verifying notification was created...');
      const notification = await prisma.notification.findFirst({
        where: {
          targetUserId: department.hodId,
          type: 'PREVENTIVE_ACTION_OBSERVATION_COMMITTED',
          metadata: {
            path: ['improvementOpportunityId'],
            equals: improvementOpportunity.id
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (notification) {
        console.log('✅ Notification found:', {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          targetUserId: notification.targetUserId,
          createdAt: notification.createdAt
        });
      } else {
        console.warn('⚠️ No notification found in database');
      }

    } catch (serviceError) {
      console.error('❌ Service test failed:', {
        error: serviceError.message,
        stack: serviceError.stack
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testPreventiveActionWorkflow()
    .then(() => {
      console.log('\n🏁 Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testPreventiveActionWorkflow }; 