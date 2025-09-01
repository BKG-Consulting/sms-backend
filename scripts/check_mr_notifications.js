#!/usr/bin/env node

const { prisma } = require('../prisma/client');

async function checkMRNotifications() {
  console.log('🔍 [MR_NOTIFICATIONS] Checking MR notifications...\n');

  const mrUserId = '85acf592-7e1d-4aad-ac0f-d2875e5ff111'; // Mwangi Martin
  const correctiveActionId = 'bc3d8e4a-d70f-4f06-b875-565df644a9c1';

  try {
    // 1. Check all notifications for MR user
    console.log('🔍 Step 1: Checking all notifications for MR user...');
    const allNotifications = await prisma.notification.findMany({
      where: {
        targetUserId: mrUserId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('📋 All Notifications for MR User:', {
      count: allNotifications.length,
      notifications: allNotifications.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        createdAt: notification.createdAt,
        isRead: notification.isRead,
        metadata: notification.metadata
      }))
    });

    // 2. Check specifically for MR notifications
    console.log('\n🔍 Step 2: Checking specifically for MR notifications...');
    const mrNotifications = allNotifications.filter(n => 
      n.type === 'CORRECTIVE_ACTION_MR_NOTIFICATION'
    );

    console.log('📋 MR Notifications Found:', {
      count: mrNotifications.length,
      notifications: mrNotifications.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        createdAt: notification.createdAt,
        isRead: notification.isRead,
        metadata: notification.metadata
      }))
    });

    // 3. Check for notifications related to this specific corrective action
    console.log('\n🔍 Step 3: Checking for notifications related to this corrective action...');
    const correctiveActionNotifications = allNotifications.filter(n => {
      if (n.metadata && typeof n.metadata === 'object') {
        return n.metadata.correctiveActionId === correctiveActionId;
      }
      return false;
    });

    console.log('📋 Corrective Action Notifications Found:', {
      count: correctiveActionNotifications.length,
      notifications: correctiveActionNotifications.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        createdAt: notification.createdAt,
        isRead: notification.isRead,
        metadata: notification.metadata
      }))
    });

    // 4. Check recent notifications (last 24 hours)
    console.log('\n🔍 Step 4: Checking recent notifications (last 24 hours)...');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentNotifications = await prisma.notification.findMany({
      where: {
        targetUserId: mrUserId,
        createdAt: {
          gte: yesterday
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('📋 Recent Notifications (Last 24 Hours):', {
      count: recentNotifications.length,
      notifications: recentNotifications.map(notification => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        link: notification.link,
        createdAt: notification.createdAt,
        isRead: notification.isRead
      }))
    });

    // 5. Check if MR user is currently active/logged in
    console.log('\n🔍 Step 5: Checking MR user status...');
    const mrUser = await prisma.user.findUnique({
      where: { id: mrUserId },
      include: {
        sessions: {
          where: {
            isActive: true,
            expiresAt: {
              gt: new Date()
            }
          }
        }
      }
    });

    console.log('📋 MR User Status:', {
      userId: mrUser.id,
      email: mrUser.email,
      name: `${mrUser.firstName} ${mrUser.lastName}`,
      verified: mrUser.verified,
      activeSessions: mrUser.sessions.length,
      lastSession: mrUser.sessions.length > 0 ? mrUser.sessions[0].lastActivity : 'No active sessions'
    });

    // 6. Summary and analysis
    console.log('\n📊 SUMMARY AND ANALYSIS:');
    console.log('========================');
    
    if (mrNotifications.length > 0) {
      console.log('✅ MR notifications WERE created successfully');
      console.log(`   - Found ${mrNotifications.length} MR notifications`);
      console.log(`   - Latest: ${mrNotifications[0].createdAt}`);
      console.log(`   - Read status: ${mrNotifications[0].isRead ? 'READ' : 'UNREAD'}`);
      
      if (mrNotifications[0].isRead) {
        console.log('💡 The MR notification was READ - maybe Mwangi Martin did receive it!');
      } else {
        console.log('💡 The MR notification is UNREAD - Mwangi Martin might not have seen it yet');
      }
    } else {
      console.log('❌ NO MR notifications found - this suggests the notification creation failed');
    }

    if (correctiveActionNotifications.length > 0) {
      console.log('✅ Corrective action notifications exist');
      console.log(`   - Found ${correctiveActionNotifications.length} notifications for this corrective action`);
    } else {
      console.log('❌ NO corrective action notifications found');
    }

    if (mrUser.sessions.length > 0) {
      console.log('✅ MR user has active sessions - they are logged in');
    } else {
      console.log('❌ MR user has no active sessions - they might not be logged in');
    }

  } catch (error) {
    console.error('❌ Error checking MR notifications:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkMRNotifications()
  .then(() => {
    console.log('\n✅ MR notifications check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ MR notifications check failed:', error);
    process.exit(1);
  }); 