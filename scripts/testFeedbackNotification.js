const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testFeedbackNotification() {
  try {
    console.log('🧪 Testing feedback notification system...');
    
    // Get a sample tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log('❌ No tenant found for testing');
      return;
    }
    console.log(`✅ Using tenant: ${tenant.name} (${tenant.id})`);
    
    // Get a sample department
    const department = await prisma.department.findFirst({
      where: { tenantId: tenant.id }
    });
    if (!department) {
      console.log('❌ No department found for testing');
      return;
    }
    console.log(`✅ Using department: ${department.name} (${department.id})`);
    
    // Get users with feedback:respond permission
    const usersWithPermission = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          {
            userRoles: {
              some: {
                role: {
                  rolePermissions: {
                    some: {
                      permission: {
                        module: 'feedback',
                        action: 'respond'
                      },
                      allowed: true
                    }
                  }
                }
              }
            }
          },
          {
            userDepartmentRoles: {
              some: {
                role: {
                  rolePermissions: {
                    some: {
                      permission: {
                        module: 'feedback',
                        action: 'respond'
                      },
                      allowed: true
                    }
                  }
                }
              }
            }
          }
        ]
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        },
        userDepartmentRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true
                  }
                }
              }
            },
            department: true
          }
        }
      }
    });
    
    console.log(`📊 Found ${usersWithPermission.length} users with feedback:respond permission`);
    
    if (usersWithPermission.length === 0) {
      console.log('❌ No users found with feedback:respond permission');
      console.log('💡 Make sure to assign the permission to roles and assign roles to users');
      return;
    }
    
    // Check which users are assigned to the test department
    const usersInDepartment = usersWithPermission.filter(user => {
      return user.userDepartmentRoles?.some(udr => udr.departmentId === department.id);
    });
    
    console.log(`📋 ${usersInDepartment.length} users are assigned to department: ${department.name}`);
    
    usersInDepartment.forEach(user => {
      console.log(`   - ${user.firstName} ${user.lastName} (${user.email})`);
      const roles = [
        ...user.userRoles.map(ur => ur.role.name),
        ...user.userDepartmentRoles.map(udr => `${udr.role.name} (${udr.department.name})`)
      ];
      console.log(`     Roles: ${roles.join(', ')}`);
    });
    
    // Test notification service function
    console.log('\n🔍 Testing notification service function...');
    
    const notificationService = require('../src/services/notificationService');
    const responders = await notificationService.getUsersWithPermission(tenant.id, 'feedback', 'respond');
    
    console.log(`📊 Notification service found ${responders.length} users with feedback:respond permission`);
    
    // Test feedback service function
    console.log('\n🔍 Testing feedback service function...');
    
    const feedbackService = require('../src/services/feedbackService');
    
    // We need to access the internal function, so let's test the logic manually
    console.log('📝 Testing department filtering logic...');
    
    const departmentResponders = responders.filter(user => {
      // Check if user is assigned to the department
      const userDepartments = user.userDepartmentRoles?.map(udr => udr.department?.id) || [];
      return userDepartments.includes(department.id);
    });
    
    console.log(`📋 ${departmentResponders.length} users would receive notifications for department: ${department.name}`);
    
    if (departmentResponders.length > 0) {
      console.log('✅ Notification system is properly configured!');
      console.log('\n📋 Users who would receive notifications:');
      departmentResponders.forEach(user => {
        console.log(`   - ${user.firstName} ${user.lastName} (${user.email})`);
      });
    } else {
      console.log('⚠️  No users would receive notifications for this department');
      console.log('💡 Make sure users with feedback:respond permission are assigned to departments');
    }
    
  } catch (error) {
    console.error('❌ Error testing feedback notification system:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testFeedbackNotification(); 