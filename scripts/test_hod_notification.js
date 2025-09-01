#!/usr/bin/env node

const { prisma } = require('../prisma/client');
const correctiveActionService = require('../src/services/correctiveActionService');

async function testHODNotification() {
  console.log('🧪 Testing HOD Notification System');
  console.log('==================================\n');

  try {
    // 1. Find an existing corrective action for Administration department
    console.log('🔍 Step 1: Finding corrective action for Administration department...');
    
    let correctiveAction = await prisma.correctiveAction.findFirst({
      where: {
        nonConformity: {
          finding: {
            department: {
              contains: 'Administration',
              mode: 'insensitive'
            }
          }
        }
      },
      include: {
        nonConformity: {
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
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!correctiveAction) {
      console.log('❌ No corrective action found for Administration department');
      console.log('🔍 Searching for any corrective action...');
      
      const anyCorrectiveAction = await prisma.correctiveAction.findFirst({
        include: {
          nonConformity: {
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
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      });

      if (!anyCorrectiveAction) {
        console.log('❌ No corrective actions found in database');
        return;
      }

      console.log(`✅ Found corrective action for department: ${anyCorrectiveAction.nonConformity.finding.department}`);
      correctiveAction = anyCorrectiveAction;
    } else {
      console.log('✅ Found corrective action for Administration department');
    }

    console.log('📋 Corrective Action Details:');
    console.log(`   ID: ${correctiveAction.id}`);
    console.log(`   Status: ${correctiveAction.status}`);
    console.log(`   Department: ${correctiveAction.nonConformity.finding.department}`);
    console.log(`   Created By: ${correctiveAction.createdBy.firstName} ${correctiveAction.createdBy.lastName}`);
    console.log(`   Tenant ID: ${correctiveAction.nonConformity.finding.audit.auditProgram.tenantId}\n`);

    // 2. Find the department HOD
    console.log('🔍 Step 2: Finding department HOD...');
    
    const department = await prisma.department.findFirst({
      where: {
        name: correctiveAction.nonConformity.finding.department,
        tenantId: correctiveAction.nonConformity.finding.audit.auditProgram.tenantId
      },
      include: {
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            verified: true
          }
        }
      }
    });

    if (!department) {
      console.log('❌ Department not found in database');
      console.log(`   Department: ${correctiveAction.nonConformity.finding.department}`);
      console.log(`   Tenant ID: ${correctiveAction.nonConformity.finding.audit.auditProgram.tenantId}`);
      return;
    }

    if (!department.hodId) {
      console.log('❌ No HOD assigned to department');
      console.log(`   Department: ${department.name}`);
      console.log('   Please assign an HOD to this department first');
      return;
    }

    console.log('✅ Found HOD:');
    console.log(`   ID: ${department.hod.id}`);
    console.log(`   Name: ${department.hod.firstName} ${department.hod.lastName}`);
    console.log(`   Email: ${department.hod.email}`);
    console.log(`   Verified: ${department.hod.verified}\n`);

    // 3. Prepare test correction requirement data
    console.log('📝 Step 3: Preparing test correction requirement...');
    
    const testCorrectionRequirement = {
      area: 'Quality Management System - Test Resubmission',
      requirement: 'Implement proper documentation controls as per ISO 9001:2015 clause 7.5 (TEST)',
      evidence: 'Missing document control procedures observed during audit inspection - TEST RESUBMISSION',
      category: 'MAJOR'
    };

    console.log('✅ Test correction requirement prepared:');
    console.log(`   Area: ${testCorrectionRequirement.area}`);
    console.log(`   Requirement: ${testCorrectionRequirement.requirement}`);
    console.log(`   Evidence: ${testCorrectionRequirement.evidence}`);
    console.log(`   Category: ${testCorrectionRequirement.category}\n`);

    // 4. Check current notification status
    console.log('📬 Step 4: Checking current notification status...');
    
    const existingNotifications = await prisma.notification.findMany({
      where: {
        type: 'CORRECTIVE_ACTION_COMMITTED',
        targetUserId: department.hodId,
        metadata: {
          path: ['correctiveActionId'],
          equals: correctiveAction.id
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Found ${existingNotifications.length} existing notifications for this corrective action`);
    
    if (existingNotifications.length > 0) {
      console.log('📋 Recent notifications:');
      existingNotifications.slice(0, 3).forEach((notification, index) => {
        console.log(`   ${index + 1}. ${notification.title} (${notification.createdAt.toISOString()})`);
      });
    }

    // 5. Resubmit the correction requirement
    console.log('\n🚀 Step 5: Resubmitting correction requirement...');
    console.log('📝 This will trigger the HOD notification system with detailed logging...\n');
    
    const startTime = Date.now();
    
    try {
      const result = await correctiveActionService.commitCorrectionRequirement({
        correctiveActionId: correctiveAction.id,
        data: testCorrectionRequirement,
        userId: correctiveAction.createdBy.id
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log('\n✅ Correction requirement resubmitted successfully!');
      console.log(`⏱️  Processing time: ${duration}ms`);
      console.log(`📊 Notification Results:`);
      console.log(`   Total departments processed: ${result.notificationResults.length}`);
      console.log(`   Successful notifications: ${result.notificationResults.filter(r => r.status === 'SUCCESS').length}`);
      console.log(`   Partial success: ${result.notificationResults.filter(r => r.status === 'PARTIAL_SUCCESS').length}`);
      console.log(`   Failed notifications: ${result.notificationResults.filter(r => r.status === 'FAILED').length}`);
      console.log(`   Has successful notifications: ${result.hasSuccessfulNotifications ? 'YES' : 'NO'}\n`);

      // 6. Show detailed notification results
      console.log('📋 Detailed Notification Results:');
      result.notificationResults.forEach((notification, index) => {
        console.log(`\n   ${index + 1}. Department: ${notification.department}`);
        console.log(`      Status: ${notification.status}`);
        console.log(`      HOD ID: ${notification.hodId || 'N/A'}`);
        
        if (notification.hodName) {
          console.log(`      HOD Name: ${notification.hodName}`);
          console.log(`      HOD Email: ${notification.hodEmail}`);
        }
        
        if (notification.notificationId) {
          console.log(`      Notification ID: ${notification.notificationId}`);
        }
        
        if (notification.reason) {
          console.log(`      Reason: ${notification.reason}`);
        }
        
        if (notification.error) {
          console.log(`      Error: ${notification.error}`);
        }
        
        if (notification.socketError) {
          console.log(`      Socket Error: ${notification.socketError}`);
        }
      });

      // 7. Check for new notifications created
      console.log('\n🔍 Step 6: Checking for new notifications created...');
      
      const newNotifications = await prisma.notification.findMany({
        where: {
          type: 'CORRECTIVE_ACTION_COMMITTED',
          targetUserId: department.hodId,
          createdAt: {
            gte: new Date(startTime)
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      console.log(`📬 Found ${newNotifications.length} new notifications created during this test`);
      
      if (newNotifications.length > 0) {
        console.log('📋 New notification details:');
        newNotifications.forEach((notification, index) => {
          console.log(`\n   ${index + 1}. Notification ID: ${notification.id}`);
          console.log(`      Title: ${notification.title}`);
          console.log(`      Message: ${notification.message}`);
          console.log(`      Link: ${notification.link}`);
          console.log(`      Created: ${notification.createdAt.toISOString()}`);
          console.log(`      Is Read: ${notification.isRead}`);
          console.log(`      Metadata: ${JSON.stringify(notification.metadata, null, 2)}`);
        });
      }

      // 8. Test debug endpoint
      console.log('\n🔍 Step 7: Testing debug endpoint...');
      
      // Simulate debug endpoint call
      const NotificationDebugger = require('../src/utils/notificationDebugger');
      const debugReport = await NotificationDebugger.generateDebugReport(correctiveAction.id);
      
      console.log('📊 Debug Report Summary:');
      console.log(`   Overall Status: ${debugReport.summary.overallStatus}`);
      console.log(`   Issues Found: ${debugReport.summary.issues.length}`);
      console.log(`   Recommendations: ${debugReport.summary.recommendations.length}`);
      
      if (debugReport.summary.issues.length > 0) {
        console.log('\n🚨 Issues Detected:');
        debugReport.summary.issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue}`);
        });
      }
      
      if (debugReport.summary.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        debugReport.summary.recommendations.forEach((rec, index) => {
          console.log(`   ${index + 1}. ${rec}`);
        });
      }

      // 9. Final summary
      console.log('\n🎉 HOD NOTIFICATION TEST COMPLETE!');
      console.log('====================================');
      console.log(`✅ Corrective Action ID: ${correctiveAction.id}`);
      console.log(`✅ Department: ${correctiveAction.nonConformity.finding.department}`);
      console.log(`✅ HOD: ${department.hod.firstName} ${department.hod.lastName}`);
      console.log(`✅ Notifications Sent: ${result.hasSuccessfulNotifications ? 'YES' : 'NO'}`);
      console.log(`✅ System Status: ${debugReport.summary.overallStatus}`);
      
      if (result.hasSuccessfulNotifications) {
        console.log('\n🚀 SUCCESS: HOD notification system is working correctly!');
        console.log('   The HOD should receive the notification and can respond.');
      } else {
        console.log('\n⚠️  WARNING: HOD notification failed. Check the issues above.');
        console.log('   Use the debug endpoint for detailed troubleshooting.');
      }

    } catch (error) {
      console.error('\n❌ Error during correction requirement resubmission:', error);
      console.error('Stack trace:', error.stack);
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
console.log('🚀 Starting HOD Notification Test...\n');
testHODNotification().catch(console.error);
