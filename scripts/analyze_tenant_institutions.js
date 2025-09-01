const prisma = require('../prisma/client')

async function analyzeTenantInstitutions() {
  console.log('🔍 ANALYZING TENANT INSTITUTIONS\n');

  try {
    // 1. Get all tenants with their basic information
    console.log('1. 📊 TENANT INSTITUTION OVERVIEW:');
    const tenants = await prisma.tenant.findMany({
      include: {
        campuses: {
          select: {
            id: true,
            name: true,
            isMain: true,
            county: true,
            city: true,
            address: true,
            departments: {
              select: {
                id: true,
                name: true,
                code: true,
                hodId: true
              }
            }
          }
        },
        departments: {
          select: {
            id: true,
            name: true,
            code: true,
            campusId: true,
            hodId: true,
            campus: {
              select: {
                id: true,
                name: true,
                isMain: true
              }
            }
          }
        },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            verified: true,
            createdAt: true,
            userRoles: {
              include: {
                role: true
              }
            },
            userDepartmentRoles: {
              include: {
                department: true,
                role: true
              }
            }
          }
        },
        _count: {
          select: {
            users: true,
            departments: true,
            campuses: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📈 Total Tenants: ${tenants.length}\n`);

    tenants.forEach((tenant, index) => {
      console.log(`📍 INSTITUTION ${index + 1}: ${tenant.name}`);
      console.log(`   ID: ${tenant.id}`);
      console.log(`   Domain: ${tenant.domain}`);
      console.log(`   Email: ${tenant.email}`);
      console.log(`   Type: ${tenant.type || 'Not specified'}`);
      console.log(`   Status: ${tenant.status || 'Not specified'}`);
      console.log(`   Created: ${tenant.createdAt}`);
      console.log(`   Phone: ${tenant.phone || 'Not specified'}`);
      console.log(`   Address: ${tenant.address || 'Not specified'}`);
      console.log(`   City: ${tenant.city || 'Not specified'}`);
      console.log(`   County: ${tenant.county || 'Not specified'}`);
      console.log(`   Country: ${tenant.country || 'Not specified'}`);
      
      // Institution type analysis
      if (tenant.type) {
        console.log(`   🏛️  Institution Type: ${tenant.type}`);
      }
      
      // Subscription info
      if (tenant.subscriptionPlan) {
        console.log(`   💳 Subscription: ${tenant.subscriptionPlan}`);
        console.log(`   👥 Max Users: ${tenant.maxUsers || 'Unlimited'}`);
        console.log(`   💾 Max Storage: ${tenant.maxStorageGB || 'Unlimited'} GB`);
      }

      // Statistics
      console.log(`   📊 Statistics:`);
      console.log(`     • Users: ${tenant._count.users}`);
      console.log(`     • Departments: ${tenant._count.departments}`);
      console.log(`     • Campuses: ${tenant._count.campuses}`);

      // Campus analysis
      console.log(`   📍 CAMPUSES (${tenant.campuses.length}):`);
      tenant.campuses.forEach(campus => {
        console.log(`     - ${campus.name} (${campus.id}) ${campus.isMain ? '[MAIN]' : ''}`);
        console.log(`       Location: ${campus.city || 'N/A'}, ${campus.county || 'N/A'}`);
        console.log(`       Address: ${campus.address || 'N/A'}`);
        console.log(`       Departments: ${campus.departments.length}`);
        campus.departments.forEach(dept => {
          console.log(`         • ${dept.name} (${dept.code || 'no code'}) ${dept.hodId ? '[HOD assigned]' : '[No HOD]'}`);
        });
      });

      // Department analysis
      console.log(`   🏢 DEPARTMENTS (${tenant.departments.length}):`);
      const departmentsWithCampus = tenant.departments.filter(d => d.campusId);
      const departmentsWithoutCampus = tenant.departments.filter(d => !d.campusId);
      const departmentsWithHOD = tenant.departments.filter(d => d.hodId);
      
      console.log(`     ✅ Linked to Campus: ${departmentsWithCampus.length}`);
      console.log(`     ❌ NOT Linked to Campus: ${departmentsWithoutCampus.length}`);
      console.log(`     👤 With HOD: ${departmentsWithHOD.length}`);
      console.log(`     👤 Without HOD: ${tenant.departments.length - departmentsWithHOD.length}`);

      if (departmentsWithoutCampus.length > 0) {
        console.log(`     ❌ Orphaned Departments:`);
        departmentsWithoutCampus.forEach(dept => {
          console.log(`       • ${dept.name} (${dept.code || 'no code'}) → NO CAMPUS`);
        });
      }

      // User analysis
      console.log(`   👥 USERS (${tenant.users.length}):`);
      const verifiedUsers = tenant.users.filter(u => u.verified);
      const unverifiedUsers = tenant.users.filter(u => !u.verified);
      
      console.log(`     ✅ Verified: ${verifiedUsers.length}`);
      console.log(`     ❌ Unverified: ${unverifiedUsers.length}`);

      // Role analysis
      const allUserRoles = tenant.users.flatMap(u => u.userRoles);
      const allDepartmentRoles = tenant.users.flatMap(u => u.userDepartmentRoles);
      
      console.log(`     🔑 User Roles: ${allUserRoles.length}`);
      console.log(`     🏢 Department Roles: ${allDepartmentRoles.length}`);

      // Recent users
      const recentUsers = tenant.users
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3);
      
      if (recentUsers.length > 0) {
        console.log(`     📅 Recent Users:`);
        recentUsers.forEach(user => {
          console.log(`       • ${user.firstName} ${user.lastName} (${user.email}) - ${user.verified ? '✅' : '❌'}`);
        });
      }

      console.log(''); // Empty line for separation
    });

    // 2. Institution type distribution
    console.log('2. 📊 INSTITUTION TYPE DISTRIBUTION:');
    const typeDistribution = await prisma.tenant.groupBy({
      by: ['type'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    typeDistribution.forEach(type => {
      console.log(`   ${type.type || 'Not specified'}: ${type._count.id} institutions`);
    });

    // 3. Geographic distribution
    console.log('\n3. 🌍 GEOGRAPHIC DISTRIBUTION:');
    const countyDistribution = await prisma.campus.groupBy({
      by: ['county'],
      where: {
        isMain: true,
        county: {
          not: null
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    console.log('   📍 By County (Main Campuses):');
    countyDistribution.forEach(county => {
      console.log(`     ${county.county}: ${county._count.id} institutions`);
    });

    // 4. Subscription analysis
    console.log('\n4. 💳 SUBSCRIPTION ANALYSIS:');
    const subscriptionDistribution = await prisma.tenant.groupBy({
      by: ['subscriptionPlan'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });

    subscriptionDistribution.forEach(sub => {
      console.log(`   ${sub.subscriptionPlan || 'Not specified'}: ${sub._count.id} institutions`);
    });

    // 5. Institution health check
    console.log('\n5. 🏥 INSTITUTION HEALTH CHECK:');
    const healthIssues = [];

    tenants.forEach(tenant => {
      const issues = [];
      
      // Check for missing main campus
      const mainCampus = tenant.campuses.find(c => c.isMain);
      if (!mainCampus) {
        issues.push('Missing main campus');
      }
      
      // Check for departments without campus
      const orphanedDepts = tenant.departments.filter(d => !d.campusId);
      if (orphanedDepts.length > 0) {
        issues.push(`${orphanedDepts.length} departments without campus`);
      }
      
      // Check for departments without HOD
      const deptsWithoutHOD = tenant.departments.filter(d => !d.hodId);
      if (deptsWithoutHOD.length > 0) {
        issues.push(`${deptsWithoutHOD.length} departments without HOD`);
      }
      
      // Check for unverified users
      const unverifiedUsers = tenant.users.filter(u => !u.verified);
      if (unverifiedUsers.length > 0) {
        issues.push(`${unverifiedUsers.length} unverified users`);
      }
      
      if (issues.length > 0) {
        healthIssues.push({
          tenant: tenant.name,
          issues
        });
      }
    });

    if (healthIssues.length === 0) {
      console.log('   ✅ All institutions are healthy');
    } else {
      console.log(`   ⚠️  Found ${healthIssues.length} institutions with issues:`);
      healthIssues.forEach(issue => {
        console.log(`     • ${issue.tenant}: ${issue.issues.join(', ')}`);
      });
    }

    // 6. Recent activity
    console.log('\n6. 📅 RECENT ACTIVITY:');
    const recentTenants = tenants.slice(0, 5);
    console.log('   🆕 Recently Created Institutions:');
    recentTenants.forEach(tenant => {
      console.log(`     • ${tenant.name} - ${tenant.createdAt}`);
    });

    // 7. Large institutions
    console.log('\n7. 🏢 LARGE INSTITUTIONS:');
    const largeInstitutions = tenants
      .filter(t => t._count.users > 10 || t._count.departments > 5)
      .sort((a, b) => b._count.users - a._count.users)
      .slice(0, 5);

    if (largeInstitutions.length > 0) {
      console.log('   📈 Institutions with >10 users or >5 departments:');
      largeInstitutions.forEach(tenant => {
        console.log(`     • ${tenant.name}: ${tenant._count.users} users, ${tenant._count.departments} departments`);
      });
    } else {
      console.log('   📈 No large institutions found');
    }

    console.log('\n✅ Institution analysis complete');

  } catch (error) {
    console.error('❌ Error analyzing institutions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
analyzeTenantInstitutions(); 