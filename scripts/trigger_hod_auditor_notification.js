const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function triggerHodAuditorNotification() {
  console.log('🔔 TRIGGERING HOD AUDITOR NOTIFICATION\n');

  try {
    // 1. Find the Computer and Informatics department
    console.log('1. 🔍 Finding Computer and Informatics department...');
    const department = await prisma.department.findFirst({
      where: {
        name: {
          contains: 'Computer',
          mode: 'insensitive'
        }
      },
      include: {
        tenant: {
          select: {
            name: true,
            domain: true
          }
        }
      }
    });

    if (!department) {
      console.log('❌ Computer and Informatics department not found');
      console.log('🔍 Available departments:');
      const allDepartments = await prisma.department.findMany({
        select: {
          name: true,
          tenant: {
            select: {
              name: true
            }
          }
        }
      });
      allDepartments.forEach(dept => {
        console.log(`   • ${dept.name} (${dept.tenant.name})`);
      });
      return;
    }

    console.log(`✅ Found department: ${department.name}`);
    console.log(`   Tenant: ${department.tenant.name}`);
    console.log(`   Department ID: ${department.id}`);

    // 2. Find HOD AUDITOR role for this tenant
    console.log('\n2. 🔍 Finding HOD AUDITOR role...');
    const hodAuditorRole = await prisma.role.findFirst({
      where: {
        name: 'HOD AUDITOR',
        tenantId: department.tenantId
      }
    });

    if (!hodAuditorRole) {
      console.log('❌ HOD AUDITOR role not found for this tenant');
      console.log('🔍 Available roles:');
      const allRoles = await prisma.role.findMany({
        where: { tenantId: department.tenantId },
        select: { name: true }
      });
      allRoles.forEach(role => {
        console.log(`   • ${role.name}`);
      });
      return;
    }

    console.log(`✅ Found HOD AUDITOR role: ${hodAuditorRole.name}`);
    console.log(`   Role ID: ${hodAuditorRole.id}`);

    // 3. Find users with HOD AUDITOR role for this department OR users with HOD AUDITOR as default role
    console.log('\n3. 🔍 Finding users with HOD AUDITOR role for this department...');
    
    // First, find users with HOD AUDITOR role specifically assigned to this department
    const hodAuditorUsersInDept = await prisma.userDepartmentRole.findMany({
      where: {
        departmentId: department.id,
        roleId: hodAuditorRole.id
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        department: {
          select: {
            name: true
          }
        },
        role: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`   Found ${hodAuditorUsersInDept.length} users with HOD AUDITOR role directly assigned to this department`);

    // Second, find users with HOD AUDITOR as their default role (regardless of department)
    console.log('\n4. 🔍 Finding users with HOD AUDITOR as default role...');
    const hodAuditorDefaultUsers = await prisma.userRole.findMany({
      where: {
        roleId: hodAuditorRole.id,
        isDefault: true
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        role: {
          select: {
            name: true
          }
        }
      }
    });

    console.log(`   Found ${hodAuditorDefaultUsers.length} users with HOD AUDITOR as default role`);

    // Combine both lists, removing duplicates
    const allHodAuditorUsers = [
      ...hodAuditorUsersInDept.map(udr => ({
        user: udr.user,
        source: 'department_assignment',
        department: udr.department.name
      })),
      ...hodAuditorDefaultUsers.map(ur => ({
        user: ur.user,
        source: 'default_role',
        department: 'Any Department (Default Role)'
      }))
    ];

    // Remove duplicates based on user ID
    const uniqueHodAuditorUsers = allHodAuditorUsers.filter((user, index, self) => 
      index === self.findIndex(u => u.user.id === user.user.id)
    );

    if (uniqueHodAuditorUsers.length === 0) {
      console.log('❌ No users found with HOD AUDITOR role (either department-specific or default)');
      
      // Check if there are any HOD AUDITOR users in the tenant at all
      const allHodAuditors = await prisma.userDepartmentRole.findMany({
        where: {
          roleId: hodAuditorRole.id
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          },
          department: {
            select: {
              name: true
            }
          }
        }
      });

      if (allHodAuditors.length > 0) {
        console.log('🔍 HOD AUDITOR users found in other departments:');
        allHodAuditors.forEach(udr => {
          console.log(`   • ${udr.user.firstName} ${udr.user.lastName} (${udr.user.email}) - ${udr.department.name}`);
        });
      }
      return;
    }

    console.log(`✅ Found ${uniqueHodAuditorUsers.length} unique HOD AUDITOR user(s):`);
    uniqueHodAuditorUsers.forEach(user => {
      console.log(`   • ${user.user.firstName} ${user.user.lastName} (${user.user.email}) - ${user.source} - ${user.department}`);
    });

    // 5. Create notifications for each HOD AUDITOR
    console.log('\n5. 🔔 Creating notifications for HOD AUDITOR users...');
    const notificationPromises = uniqueHodAuditorUsers.map(async (user) => {
      const notification = await prisma.notification.create({
        data: {
          targetUser: {
            connect: {
              id: user.user.id
            }
          },
          title: 'Change Request Notification',
          message: `A change request has been submitted for the ${department.name} department. As HOD AUDITOR, please review and take appropriate action.`,
          type: 'CHANGE_REQUEST',
          priority: 'HIGH',
          metadata: {
            departmentId: department.id,
            departmentName: department.name,
            role: 'HOD AUDITOR',
            source: user.source,
            actionRequired: true
          }
        }
      });

      console.log(`   ✅ Notification created for ${user.user.firstName} ${user.user.lastName} (${user.source})`);
      return notification;
    });

    const notifications = await Promise.all(notificationPromises);

    // 6. Log the notification details
    console.log('\n6. 📋 Notification Summary:');
    console.log(`   Total notifications sent: ${notifications.length}`);
    console.log(`   Department: ${department.name}`);
    console.log(`   Role: HOD AUDITOR`);
    console.log(`   Priority: HIGH`);
    console.log(`   Type: CHANGE_REQUEST`);

    // 7. Verify notifications were created
    console.log('\n7. 🔍 Verifying notifications...');
    const verificationCount = await prisma.notification.count({
      where: {
        userId: {
          in: uniqueHodAuditorUsers.map(user => user.user.id)
        },
        type: 'CHANGE_REQUEST',
        title: 'Change Request Notification'
      }
    });

    if (verificationCount === notifications.length) {
      console.log(`✅ Verification successful! ${verificationCount} notifications confirmed.`);
    } else {
      console.log(`❌ Verification failed! Expected ${notifications.length}, found ${verificationCount}`);
    }

    // 8. Show notification details
    console.log('\n8. 📄 Notification Details:');
    const recentNotifications = await prisma.notification.findMany({
      where: {
        userId: {
          in: uniqueHodAuditorUsers.map(user => user.user.id)
        },
        type: 'CHANGE_REQUEST'
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: notifications.length
    });

    recentNotifications.forEach(notification => {
      console.log(`   📧 To: ${notification.user.firstName} ${notification.user.lastName} (${notification.user.email})`);
      console.log(`   📝 Message: ${notification.message}`);
      console.log(`   ⏰ Created: ${notification.createdAt}`);
      console.log(`   📊 Metadata: ${JSON.stringify(notification.metadata)}`);
      console.log('');
    });

    console.log('✅ HOD AUDITOR notification trigger completed successfully!');

  } catch (error) {
    console.error('❌ Error triggering HOD AUDITOR notification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the notification trigger
triggerHodAuditorNotification(); 