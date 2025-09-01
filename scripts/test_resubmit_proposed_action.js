#!/usr/bin/env node

const { prisma } = require('../prisma/client');


async function resubmitProposedAction() {
  console.log('\n🔄 Testing Proposed Action Resubmission');
  console.log('=====================================\n');

  try {
    // 1. Find an existing corrective action with valid non-conformity
    const correctiveAction = await prisma.correctiveAction.findFirst({
      where: {
        status: {
          in: ['OPEN', 'IN_PROGRESS']
        }
      },
      include: {
        nonConformity: {
          include: {
            finding: true
          }
        },
        createdBy: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!correctiveAction) {
      console.log('❌ No corrective action found to test with');
      return;
    }

    console.log('📋 Found Corrective Action:');
    console.log(`   ID: ${correctiveAction.id}`);
    console.log(`   NonConformity ID: ${correctiveAction.nonConformityId}`);
    console.log(`   Created By: ${correctiveAction.createdBy?.email || 'unknown'}`);

    // 2. Submit a new proposed action (direct DB update for testing)
    const updatedCA = await prisma.correctiveAction.update({
      where: { id: correctiveAction.id },
      data: {
        proposedAction: {
          rootCause: "Inadequate documentation control procedures",
          correction: "Implement comprehensive document control system",
          correctiveAction: "Establish document control procedures as per ISO 9001:2015 clause 7.5",
          completionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
          auditee: correctiveAction.createdBy.firstName + " " + correctiveAction.createdBy.lastName
        },
        appropriatenessReview: null
      },
      include: {
        nonConformity: true,
        createdBy: true
      }
    });

    console.log('\n✅ Updated Corrective Action:');
    console.log(`   New Proposed Action: ${updatedCA.proposedAction}`);

    // 2.5. Manually create a notification with the CORRECT link for testing
    const notificationRepository = require('../src/repositories/notification.repository');
    await notificationRepository.createNotification({
      type: 'ROOT_CAUSE_ANALYSIS_SUBMITTED',
      title: 'Root Cause Analysis Submitted (Test)',
      message: `The HOD has submitted a root cause analysis for corrective action: ${updatedCA.title}.`,
      tenantId: updatedCA.createdBy.tenantId,
      targetUserId: updatedCA.createdById,
      link: `/auditors/corrective-actions/${updatedCA.nonConformityId}`, // CORRECT: using nonConformityId
      metadata: { 
        correctiveActionId: updatedCA.id, 
        nonConformityId: updatedCA.nonConformityId 
      },
    });

    // 3. Wait briefly for notification to be created
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. Find the notification that was created
    const notification = await prisma.notification.findFirst({
      where: {
        type: 'ROOT_CAUSE_ANALYSIS_SUBMITTED',
        metadata: {
          path: ['correctiveActionId'],
          equals: correctiveAction.id
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!notification) {
      console.log('\n❌ No notification was created');
      return;
    }

    console.log('\n📨 Created Notification:');
    console.log(`   Type: ${notification.type}`);
    console.log(`   Link: ${notification.link}`);
    console.log(`   Target User: ${notification.targetUserId}`);
    console.log(`   Metadata:`, notification.metadata);

    // 5. Verify routing
    const linkMatch = notification.link.match(/\/auditors\/corrective-actions\/(.+)$/);
    if (!linkMatch) {
      console.log('\n❌ Invalid notification link format');
      return;
    }

    const routeParam = linkMatch[1];
    console.log('\n🔍 Route Parameter Analysis:');
    console.log(`   Parameter: ${routeParam}`);
    console.log(`   Expected: ${correctiveAction.nonConformityId}`);
    console.log(`   Match: ${routeParam === correctiveAction.nonConformityId ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Details:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
resubmitProposedAction().catch(console.error);


// Run the test
resubmitProposedAction().catch(console.error);
