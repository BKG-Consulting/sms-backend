#!/usr/bin/env node

const { prisma } = require('../prisma/client');

async function fixMRRole() {
  console.log('🔧 [MR_FIX] Starting MR role fix...\n');

  const tenantId = 'ebfa3128-8eb5-4e0e-bdc5-bae82f0e7463'; // RTVC tenant

  try {
    // 1. Check if MR role exists
    console.log('🔍 Step 1: Checking if MR role exists...');
    let mrRole = await prisma.role.findFirst({
      where: { 
        name: 'MR',
        tenantId 
      }
    });

    if (!mrRole) {
      console.log('📝 Creating MR role...');
      mrRole = await prisma.role.create({
        data: {
          name: 'MR',
          description: 'Management Representative for audit management',
          tenantId: tenantId,
          isDefault: false,
          isRemovable: false,
          defaultContext: 'dashboard',
          loginDestination: '/dashboard'
        }
      });
      console.log('✅ MR role created:', mrRole.id);
    } else {
      console.log('✅ MR role already exists:', mrRole.id);
    }

    // 2. Find potential MR users (look for users who might be MR)
    console.log('\n🔍 Step 2: Finding potential MR users...');
    const allUsers = await prisma.user.findMany({
      where: { tenantId },
      include: {
        userRoles: {
          include: { role: true }
        },
        userDepartmentRoles: {
          include: { role: true }
        }
      }
    });

    // Look for users who might be MR (by name or email patterns)
    const potentialMRUsers = allUsers.filter(user => {
      const name = `${user.firstName} ${user.lastName}`.toLowerCase();
      const email = user.email.toLowerCase();
      return name.includes('mr') || 
             name.includes('management') || 
             name.includes('representative') ||
             email.includes('mr') ||
             email.includes('management') ||
             email.includes('representative') ||
             email.includes('principal') ||
             email.includes('director');
    });

    console.log('📋 Potential MR Users Found:', {
      count: potentialMRUsers.length,
      users: potentialMRUsers.map(user => ({
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        verified: user.verified,
        userRoles: user.userRoles.map(ur => ur.role.name),
        userDepartmentRoles: user.userDepartmentRoles.map(udr => udr.role.name)
      }))
    });

    // 3. If no potential MR users found, look for users with high-level roles
    let mrUser = null;
    if (potentialMRUsers.length === 0) {
      console.log('\n🔍 Step 3: No potential MR users found, looking for users with high-level roles...');
      
      // Look for users with roles like PRINCIPAL, DIRECTOR, etc.
      const highLevelUsers = allUsers.filter(user => {
        const allRoles = [
          ...user.userRoles.map(ur => ur.role.name),
          ...user.userDepartmentRoles.map(udr => udr.role.name)
        ];
        return allRoles.some(role => 
          ['PRINCIPAL', 'DIRECTOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(role.toUpperCase())
        );
      });

      console.log('📋 High-Level Users Found:', {
        count: highLevelUsers.length,
        users: highLevelUsers.map(user => ({
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          verified: user.verified,
          userRoles: user.userRoles.map(ur => ur.role.name),
          userDepartmentRoles: user.userDepartmentRoles.map(udr => udr.role.name)
        }))
      });

      if (highLevelUsers.length > 0) {
        // Use the first high-level user as MR
        mrUser = highLevelUsers[0];
        console.log(`✅ Selected high-level user as MR: ${mrUser.email}`);
      }
    } else {
      // Use the first potential MR user
      mrUser = potentialMRUsers[0];
      console.log(`✅ Selected potential MR user: ${mrUser.email}`);
    }

    // 4. If still no MR user found, create one or assign to an existing user
    if (!mrUser) {
      console.log('\n🔍 Step 4: No suitable MR user found, looking for any verified user...');
      
      const verifiedUsers = allUsers.filter(user => user.verified);
      
      if (verifiedUsers.length > 0) {
        mrUser = verifiedUsers[0];
        console.log(`✅ Selected verified user as MR: ${mrUser.email}`);
      } else {
        console.error('❌ No verified users found to assign MR role to');
        return;
      }
    }

    // 5. Assign MR role to the selected user
    console.log('\n🔧 Step 5: Assigning MR role to user...');
    
    // Check if user already has MR role
    const hasMRRole = mrUser.userRoles.some(ur => ur.role.name === 'MR') ||
                     mrUser.userDepartmentRoles.some(udr => udr.role.name === 'MR');

    if (hasMRRole) {
      console.log('✅ User already has MR role');
    } else {
      // Assign MR role as a user role (not department-specific)
      await prisma.userRole.create({
        data: {
          userId: mrUser.id,
          roleId: mrRole.id,
          isDefault: false
        }
      });
      console.log(`✅ MR role assigned to user: ${mrUser.email}`);
    }

    // 6. Verify the fix
    console.log('\n🔍 Step 6: Verifying the fix...');
    const updatedMRUser = await prisma.user.findFirst({
      where: {
        id: mrUser.id
      },
      include: {
        userRoles: {
          include: { role: true }
        },
        userDepartmentRoles: {
          include: { role: true }
        }
      }
    });

    const hasMRRoleNow = updatedMRUser.userRoles.some(ur => ur.role.name === 'MR') ||
                        updatedMRUser.userDepartmentRoles.some(udr => udr.role.name === 'MR');

    console.log('📋 Verification Results:', {
      userId: updatedMRUser.id,
      email: updatedMRUser.email,
      name: `${updatedMRUser.firstName} ${updatedMRUser.lastName}`,
      hasMRRole: hasMRRoleNow,
      userRoles: updatedMRUser.userRoles.map(ur => ur.role.name),
      userDepartmentRoles: updatedMRUser.userDepartmentRoles.map(udr => udr.role.name)
    });

    if (hasMRRoleNow) {
      console.log('✅ MR role fix completed successfully!');
      console.log(`📧 MR User: ${updatedMRUser.email} (${updatedMRUser.firstName} ${updatedMRUser.lastName})`);
    } else {
      console.error('❌ MR role assignment failed');
    }

  } catch (error) {
    console.error('❌ Error during MR role fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixMRRole()
  .then(() => {
    console.log('\n✅ MR role fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ MR role fix failed:', error);
    process.exit(1);
  }); 