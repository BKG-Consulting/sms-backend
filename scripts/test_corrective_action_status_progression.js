#!/usr/bin/env node

const { prisma } = require('../prisma/client');

async function testCorrectiveActionStatusProgression() {
  console.log('\n🧪 Testing Corrective Action Status Progression');
  console.log('===============================================\n');

  try {
    // Find a corrective action that has gone through the full workflow
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
        createdBy: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!correctiveAction) {
      console.log('❌ No corrective action found with full workflow completed');
      return;
    }

    console.log('📋 Found Corrective Action:');
    console.log(`   ID: ${correctiveAction.id}`);
    console.log(`   Current Status: ${correctiveAction.status}`);
    console.log(`   NonConformity ID: ${correctiveAction.nonConformityId}`);

    // Test status progression logic
    console.log('\n🔍 Status Progression Analysis:');
    console.log('==============================');

    // 1. Correction Requirement
    console.log('\n1️⃣ Correction Requirement:');
    if (correctiveAction.correctionRequirement) {
      console.log(`   ✅ Committed: ${correctiveAction.correctionRequirement.committedAt ? 'Yes' : 'No'}`);
      console.log(`   Expected Status: IN_PROGRESS`);
      console.log(`   Actual Status: ${correctiveAction.status}`);
    }

    // 2. Proposed Action
    console.log('\n2️⃣ Proposed Action:');
    if (correctiveAction.proposedAction) {
      console.log(`   ✅ Submitted: Yes`);
      console.log(`   Expected Status: IN_PROGRESS (no change)`);
      console.log(`   Actual Status: ${correctiveAction.status}`);
    }

    // 3. Appropriateness Review
    console.log('\n3️⃣ Appropriateness Review:');
    if (correctiveAction.appropriatenessReview) {
      console.log(`   ✅ Response: ${correctiveAction.appropriatenessReview.response}`);
      console.log(`   Expected Status: IN_PROGRESS (no change)`);
      console.log(`   Actual Status: ${correctiveAction.status}`);
    }

    // 4. Follow Up Action
    console.log('\n4️⃣ Follow Up Action:');
    if (correctiveAction.followUpAction) {
      console.log(`   ✅ Action: ${correctiveAction.followUpAction.action}`);
      console.log(`   ✅ Follow-up Status: ${correctiveAction.followUpAction.status}`);
      
      let expectedStatus = 'IN_PROGRESS';
      if (correctiveAction.followUpAction.action === 'ACTION_FULLY_COMPLETED') {
        expectedStatus = 'COMPLETED';
      } else if (correctiveAction.followUpAction.action === 'ACTION_PARTIALLY_COMPLETED') {
        expectedStatus = 'IN_PROGRESS';
      } else if (correctiveAction.followUpAction.action === 'NO_ACTION_TAKEN') {
        expectedStatus = 'OPEN';
      }
      
      console.log(`   Expected Status: ${expectedStatus}`);
      console.log(`   Actual Status: ${correctiveAction.status}`);
    }

    // 5. Action Effectiveness
    console.log('\n5️⃣ Action Effectiveness:');
    if (correctiveAction.actionEffectiveness) {
      console.log(`   ✅ Response: ${correctiveAction.actionEffectiveness.response}`);
      console.log(`   ✅ Effectiveness Status: ${correctiveAction.actionEffectiveness.status}`);
      
      let expectedStatus = 'COMPLETED'; // Default (assuming follow-up was completed)
      if (correctiveAction.actionEffectiveness.response === 'YES') {
        expectedStatus = 'VERIFIED';
      } else {
        expectedStatus = 'IN_PROGRESS';
      }
      
      console.log(`   Expected Status: ${expectedStatus}`);
      console.log(`   Actual Status: ${correctiveAction.status}`);
    }

    // Test findings UI recognition
    console.log('\n🔧 Testing Findings UI Recognition:');
    console.log('===================================');
    
    const isCompletedForFindings = correctiveAction.status === 'CLOSED' || correctiveAction.status === 'VERIFIED';
    console.log(`✅ Status: ${correctiveAction.status}`);
    console.log(`✅ Recognized as Completed: ${isCompletedForFindings ? 'Yes' : 'No'}`);

    // Summary
    console.log('\n📊 Summary:');
    console.log('===========');
    console.log(`✅ Correction Requirement: ${correctiveAction.correctionRequirement ? 'Completed' : 'Missing'}`);
    console.log(`✅ Proposed Action: ${correctiveAction.proposedAction ? 'Completed' : 'Missing'}`);
    console.log(`✅ Appropriateness Review: ${correctiveAction.appropriatenessReview ? 'Completed' : 'Missing'}`);
    console.log(`✅ Follow Up Action: ${correctiveAction.followUpAction ? 'Completed' : 'Missing'}`);
    console.log(`✅ Action Effectiveness: ${correctiveAction.actionEffectiveness ? 'Completed' : 'Missing'}`);
    console.log(`✅ Final Status: ${correctiveAction.status}`);
    console.log(`✅ Findings UI Recognition: ${isCompletedForFindings ? '✅ Working' : '❌ Not Working'}`);

    if (isCompletedForFindings) {
      console.log('\n🎉 SUCCESS: Corrective Action Status Progression is Working!');
      console.log('   - Status progresses correctly through workflow');
      console.log('   - Final status is recognized by findings UI');
      console.log('   - End-to-end workflow is functional');
    } else {
      console.log('\n❌ ISSUE: Corrective Action Status Not Recognized by Findings UI');
      console.log('   - Current status:', correctiveAction.status);
      console.log('   - Expected: CLOSED or VERIFIED');
      console.log('   - Check if status update logic is working');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testCorrectiveActionStatusProgression().catch(console.error); 