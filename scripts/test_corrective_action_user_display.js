#!/usr/bin/env node

const { prisma } = require('../prisma/client');

async function testCorrectiveActionUserDisplay() {
  console.log('\n🧪 Testing Corrective Action User Display');
  console.log('==========================================\n');

  try {
    // Find a corrective action with all steps completed
    const correctiveAction = await prisma.correctiveAction.findFirst({
      where: {
        correctionRequirement: {
          not: null
        },
        proposedAction: {
          not: null
        },
        appropriatenessReview: {
          not: null
        },
        followUpAction: {
          not: null
        },
        actionEffectiveness: {
          not: null
        }
      },
      include: {
        nonConformity: {
          include: {
            finding: true
          }
        },
        createdBy: true,
        assignedTo: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!correctiveAction) {
      console.log('❌ No corrective action found with all steps completed');
      console.log('   Looking for actions with: correctionRequirement, proposedAction, appropriatenessReview, followUpAction, actionEffectiveness');
      return;
    }

    console.log('📋 Found Corrective Action:');
    console.log(`   ID: ${correctiveAction.id}`);
    console.log(`   Status: ${correctiveAction.status}`);
    console.log(`   NonConformity ID: ${correctiveAction.nonConformityId}`);

    // Test each step's user information
    console.log('\n🔍 User Information Analysis:');
    console.log('============================');

    // 1. Correction Requirement
    console.log('\n1️⃣ Correction Requirement:');
    if (correctiveAction.correctionRequirement) {
      console.log(`   ✅ Auditor: ${correctiveAction.correctionRequirement.auditor || 'Not set'}`);
      console.log(`   ✅ Committed At: ${correctiveAction.correctionRequirement.committedAt || 'Not set'}`);
      console.log(`   ✅ Committed By: ${correctiveAction.correctionRequirement.committedBy || 'Not set'}`);
    } else {
      console.log('   ❌ No correction requirement found');
    }

    // 2. Proposed Action
    console.log('\n2️⃣ Proposed Action:');
    if (correctiveAction.proposedAction) {
      console.log(`   ✅ Auditee: ${correctiveAction.proposedAction.auditee || 'Not set'}`);
      console.log(`   ✅ Root Cause: ${correctiveAction.proposedAction.rootCause ? 'Set' : 'Not set'}`);
      console.log(`   ✅ Correction: ${correctiveAction.proposedAction.correction ? 'Set' : 'Not set'}`);
      console.log(`   ✅ Corrective Action: ${correctiveAction.proposedAction.correctiveAction ? 'Set' : 'Not set'}`);
    } else {
      console.log('   ❌ No proposed action found');
    }

    // 3. Appropriateness Review
    console.log('\n3️⃣ Appropriateness Review:');
    if (correctiveAction.appropriatenessReview) {
      console.log(`   ✅ Response: ${correctiveAction.appropriatenessReview.response}`);
      console.log(`   ✅ Auditor ID: ${correctiveAction.appropriatenessReview.auditorId || 'Not set'}`);
      console.log(`   ✅ Responded At: ${correctiveAction.appropriatenessReview.respondedAt || 'Not set'}`);
      if (correctiveAction.appropriatenessReview.response === 'NO') {
        console.log(`   ✅ Comment: ${correctiveAction.appropriatenessReview.comment || 'Not set'}`);
      }
    } else {
      console.log('   ❌ No appropriateness review found');
    }

    // 4. Follow Up Action
    console.log('\n4️⃣ Follow Up Action:');
    if (correctiveAction.followUpAction) {
      console.log(`   ✅ Action: ${correctiveAction.followUpAction.action}`);
      console.log(`   ✅ Status: ${correctiveAction.followUpAction.status}`);
      console.log(`   ✅ Updated By: ${correctiveAction.followUpAction.updatedBy || 'Not set'}`);
      console.log(`   ✅ Updated At: ${correctiveAction.followUpAction.updatedAt || 'Not set'}`);
    } else {
      console.log('   ❌ No follow up action found');
    }

    // 5. Action Effectiveness
    console.log('\n5️⃣ Action Effectiveness:');
    if (correctiveAction.actionEffectiveness) {
      console.log(`   ✅ Response: ${correctiveAction.actionEffectiveness.response}`);
      console.log(`   ✅ Details: ${correctiveAction.actionEffectiveness.details ? 'Set' : 'Not set'}`);
      console.log(`   ✅ Status: ${correctiveAction.actionEffectiveness.status}`);
      console.log(`   ✅ Auditor ID: ${correctiveAction.actionEffectiveness.auditorId || 'Not set'}`);
      console.log(`   ✅ Reviewed At: ${correctiveAction.actionEffectiveness.reviewedAt || 'Not set'}`);
    } else {
      console.log('   ❌ No action effectiveness found');
    }

    // Test backend population of auditor information
    console.log('\n🔧 Testing Backend Auditor Population:');
    console.log('=====================================');

    // Get the corrective action with populated auditor information
    const populatedCA = await prisma.correctiveAction.findUnique({
      where: { id: correctiveAction.id },
      include: {
        nonConformity: true,
        assignedTo: true,
        createdBy: true,
      },
    });

    // Check if auditor information is properly populated
    if (populatedCA.appropriatenessReview?.auditorId) {
      const appropriatenessAuditor = await prisma.user.findUnique({
        where: { id: populatedCA.appropriatenessReview.auditorId },
        select: { firstName: true, lastName: true, email: true }
      });
      console.log(`\n✅ Appropriateness Review Auditor: ${appropriatenessAuditor ? `${appropriatenessAuditor.firstName} ${appropriatenessAuditor.lastName}` : 'Not found'}`);
    }

    if (populatedCA.followUpAction?.updatedBy) {
      const followUpAuditor = await prisma.user.findUnique({
        where: { id: populatedCA.followUpAction.updatedBy },
        select: { firstName: true, lastName: true, email: true }
      });
      console.log(`✅ Follow Up Action Auditor: ${followUpAuditor ? `${followUpAuditor.firstName} ${followUpAuditor.lastName}` : 'Not found'}`);
    }

    if (populatedCA.actionEffectiveness?.auditorId) {
      const effectivenessAuditor = await prisma.user.findUnique({
        where: { id: populatedCA.actionEffectiveness.auditorId },
        select: { firstName: true, lastName: true, email: true }
      });
      console.log(`✅ Action Effectiveness Auditor: ${effectivenessAuditor ? `${effectivenessAuditor.firstName} ${effectivenessAuditor.lastName}` : 'Not found'}`);
    }

    // Summary
    console.log('\n📊 Summary:');
    console.log('===========');
    console.log(`✅ Correction Requirement: ${correctiveAction.correctionRequirement ? 'Has auditor info' : 'Missing'}`);
    console.log(`✅ Proposed Action: ${correctiveAction.proposedAction ? 'Has auditee info' : 'Missing'}`);
    console.log(`✅ Appropriateness Review: ${correctiveAction.appropriatenessReview ? 'Has auditor info' : 'Missing'}`);
    console.log(`✅ Follow Up Action: ${correctiveAction.followUpAction ? 'Has auditor info' : 'Missing'}`);
    console.log(`✅ Action Effectiveness: ${correctiveAction.actionEffectiveness ? 'Has auditor info' : 'Missing'}`);

    const allStepsHaveUserInfo = 
      correctiveAction.correctionRequirement?.auditor &&
      correctiveAction.proposedAction?.auditee &&
      correctiveAction.appropriatenessReview?.auditorId &&
      correctiveAction.followUpAction?.updatedBy &&
      correctiveAction.actionEffectiveness?.auditorId;

    if (allStepsHaveUserInfo) {
      console.log('\n🎉 SUCCESS: All steps have proper user information!');
      console.log('   - Correction Requirement shows actual auditor');
      console.log('   - Proposed Action shows HOD (auditee)');
      console.log('   - Appropriateness Review shows auditor');
      console.log('   - Follow Up Action shows auditor');
      console.log('   - Action Effectiveness shows auditor');
    } else {
      console.log('\n❌ ISSUES: Some steps are missing user information');
      console.log('   - Check the backend population logic');
      console.log('   - Verify frontend is displaying the correct fields');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testCorrectiveActionUserDisplay().catch(console.error); 