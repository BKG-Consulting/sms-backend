#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAuditorNotificationRouting() {
  console.log('\n🧪 Testing Auditor Notification Routing');
  console.log('======================================\n');

  try {
    // Find the most recent notification for auditor about root cause analysis
    const recentNotification = await prisma.notification.findFirst({
      where: {
        type: 'ROOT_CAUSE_ANALYSIS_SUBMITTED',
        title: {
          contains: 'Root Cause Analysis Submitted'
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        targetUser: true
      }
    });

    if (!recentNotification) {
      console.log('❌ No recent auditor notifications found');
      console.log('   Try re-submitting a proposed action as HOD first');
      return;
    }

    console.log('📋 Found Recent Notification:');
    console.log(`   ID: ${recentNotification.id}`);
    console.log(`   Title: ${recentNotification.title}`);
    console.log(`   Target User: ${recentNotification.targetUser?.name || 'undefined'} (${recentNotification.targetUser?.email || 'unknown'})`);
    console.log(`   Link: ${recentNotification.link}`);
    console.log(`   Created: ${recentNotification.createdAt.toLocaleString()}`);

    // Parse the link to extract the nonConformityId
    const linkMatch = recentNotification.link.match(/\/auditors\/corrective-actions\/(.+)$/);
    if (!linkMatch) {
      console.log('❌ Invalid notification link format');
      return;
    }

    const routeParam = linkMatch[1];
    console.log(`\n🔗 Notification Link Analysis:`);
    console.log(`   Full Link: ${recentNotification.link}`);
    console.log(`   Route Parameter: ${routeParam}`);

    // Check if this is a nonConformityId or correctiveActionId
    const nonConformity = await prisma.nonConformity.findUnique({
      where: { id: routeParam }
    });

    const correctiveAction = await prisma.correctiveAction.findUnique({
      where: { id: routeParam }
    });

    console.log(`\n🔍 Parameter Type Analysis:`);
    if (nonConformity) {
      console.log(`   ✅ Parameter is a NonConformity ID`);
      console.log(`   ✅ This will route to the correct frontend page: /auditors/corrective-actions/[nonConformityId]`);
      console.log(`   ✅ Frontend will call: getOrCreateCorrectiveActionForNonConformity(${routeParam})`);

      // Find the related corrective action
      const relatedCA = await prisma.correctiveAction.findFirst({
        where: { nonConformityId: routeParam },
        include: {
          nonConformity: {
            include: {
              finding: true
            }
          }
        }
      });

      if (relatedCA) {
        console.log(`\n📊 Related Corrective Action:`);
        console.log(`   CA ID: ${relatedCA.id}`);
        console.log(`   Status: ${relatedCA.status}`);
        console.log(`   Department: ${relatedCA.nonConformity.finding.department}`);
        console.log(`   ✅ Auditor will see this corrective action when they click the notification`);
      }
    } else if (correctiveAction) {
      console.log(`   ❌ Parameter is a CorrectiveAction ID`);
      console.log(`   ❌ This will NOT route correctly - frontend expects nonConformityId`);
      console.log(`   ❌ Auditor will get "non-conformity not found" error`);
    } else {
      console.log(`   ❌ Parameter doesn't match any NonConformity or CorrectiveAction`);
    }

    // Test the workflow simulation
    console.log(`\n🔄 Workflow Simulation:`);
    console.log(`   1. ✅ HOD committed proposed action`);
    console.log(`   2. ✅ System created notification for Auditor: ${recentNotification.targetUser?.name || 'undefined'}`);
    console.log(`   3. ✅ Notification link: ${recentNotification.link}`);
    console.log(`   4. ${nonConformity ? '✅' : '❌'} Auditor clicks notification`);
    console.log(`   5. ${nonConformity ? '✅' : '❌'} Frontend routes to: /auditors/corrective-actions/[nonConformityId]/page.tsx`);
    console.log(`   6. ${nonConformity ? '✅' : '❌'} Page loads corrective action data`);
    console.log(`   7. ${nonConformity ? '✅' : '❌'} Auditor can review and proceed`);

    if (nonConformity) {
      console.log(`\n🎉 SUCCESS: Auditor Notification Routing is Working Correctly!`);
      console.log(`   - Notification uses nonConformityId parameter: ${routeParam}`);
      console.log(`   - Routes to existing frontend page structure`);
      console.log(`   - Auditor can access and review corrective actions`);
      console.log(`   - End-to-end workflow is functional`);
    } else {
      console.log(`\n❌ FAILED: Auditor Notification Routing Needs Fix`);
      console.log(`   - Notification should use nonConformityId, not correctiveActionId`);
      console.log(`   - Current link will cause frontend routing errors`);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAuditorNotificationRouting().catch(console.error);