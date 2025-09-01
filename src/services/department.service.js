const { prisma } = require('../../prisma/client');
const { createDepartment: createDepartmentRepo } = require('../repositories/departmentRepository'); // Rename import to avoid conflict
const { findTenantById } = require('../repositories/tenantRepository');
const { findUserById } = require('../repositories/userRepository');
const { logger } = require('../utils/logger.util');
const { AppError } = require('../../errors/app.error');
const bcrypt = require('bcryptjs');

const createDepartment = async ({ name, code, campusId, tenantId, createdBy }) => {
  if (!name || !tenantId) {
    throw new AppError('Missing required fields: name, tenantId', 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await findTenantById(tenantId, tx);
      if (!tenant) throw new AppError('Tenant not found', 404);

      // If no campusId provided, find the main campus for this tenant
      let finalCampusId = campusId;
      if (!finalCampusId) {
        const mainCampus = await tx.campus.findFirst({
          where: { 
            tenantId: tenantId,
            isMain: true 
          }
        });
        
        if (mainCampus) {
          finalCampusId = mainCampus.id;
          console.log(`📍 Auto-assigned department "${name}" to main campus: ${mainCampus.name}`);
        } else {
          console.warn(`⚠️  No main campus found for tenant ${tenantId}, creating department without campus`);
        }
      }

      // Create department
      const department = await createDepartmentRepo(
        {
          name,
          code,
          campusId: finalCampusId,
          tenantId,
        },
        tx,
        {
          id: true,
          name: true,
          code: true,
          campusId: true,
          tenantId: true,
          createdAt: true,
          updatedAt: true,
          campus: {
            select: {
              id: true,
              name: true
            }
          }
        }
      );
      return department;
    });
    return result;
  } catch (error) {
    logger.error('Error creating department:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

const getDepartmentsByTenant = async (tenantId) => {
  try {
    const departments = await prisma.department.findMany({
      where: { tenantId },
      include: {
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        campus: {
          select: {
            id: true,
            name: true
          }
        },
        _count: {
          select: {
            userDepartmentRoles: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    // Map the departments to include userCount
    return departments.map(dept => ({
      ...dept,
      userCount: dept._count.userDepartmentRoles
    }));
  } catch (error) {
    logger.error('Error fetching departments by tenant:', error);
    throw error.isOperational ? error : new AppError(`Server error: ${error.message}`, 500);
  }
};

async function updateDepartmentWithHOD({ departmentId, name, code, head, tenantId, updatedBy }) {
  return prisma.$transaction(async (tx) => {
    // 1. Fetch current department and HOD
    const department = await tx.department.findUnique({
      where: { id: departmentId },
      include: { hod: true }
    });
    if (!department) throw new Error('Department not found');

    // 2. Update department fields
    const updateData = {};
    if (name) updateData.name = name;
    if (code) updateData.code = code;

    let newHodUser = null;
    let hodRole = await tx.role.findFirst({ where: { name: 'HOD', tenantId } });
    if (!hodRole) {
      hodRole = await tx.role.create({
        data: {
          name: 'HOD',
          description: 'Head of Department',
          tenant: { connect: { id: tenantId } }
        }
      });
    }

    // 3. Handle HOD change logic
    if (head) {
      // If head is a userId, fetch user; if head is user details, create user
      if (head.userId) {
        newHodUser = await tx.user.findUnique({ where: { id: head.userId } });
        if (!newHodUser) throw new Error('New HOD user not found');
      } else if (head.email && head.firstName && head.lastName && head.password) {
        const hashedPassword = await bcrypt.hash(head.password, 10);
        newHodUser = await tx.user.create({
          data: {
            email: head.email,
            firstName: head.firstName,
            lastName: head.lastName,
            password: hashedPassword,
            tenant: { connect: { id: tenantId } },
            verified: true,
            createdBy: updatedBy,
          }
        });
      }

      // If HOD is changing
      if (department.hodId && (!newHodUser || department.hodId !== newHodUser.id)) {
        // Remove HOD role from previous HOD, assign Staff (or default) role
        let staffRole = await tx.role.findFirst({ where: { name: 'STAFF', tenantId } });
        if (!staffRole) {
          staffRole = await tx.role.create({
            data: {
              name: 'STAFF',
              description: 'Staff member',
              tenant: { connect: { id: tenantId } }
            }
          });
        }
        await tx.userRole.deleteMany({ where: { userId: department.hodId, roleId: hodRole.id } });
        if (staffRole) {
          await tx.userRole.create({ data: { userId: department.hodId, roleId: staffRole.id } });
        }
      }

      // Assign HOD role to new HOD if not already assigned
      const hodRoleAssigned = await tx.userRole.findFirst({
        where: { userId: newHodUser.id, roleId: hodRole.id }
      });
      if (!hodRoleAssigned) {
        await tx.userRole.create({ data: { userId: newHodUser.id, roleId: hodRole.id } });
      }

      updateData.hodId = newHodUser.id;
    } else if (department.hodId) {
      // If HOD is being removed
      await tx.userRole.deleteMany({ where: { userId: department.hodId, roleId: hodRole.id } });
      updateData.hodId = null;
    }

    // 4. Update department
    const updatedDepartment = await tx.department.update({
      where: { id: departmentId },
      data: updateData,
      include: { hod: true }
    });

    return {
      ...updatedDepartment,
      hod: updatedDepartment.hod
        ? {
            id: updatedDepartment.hod.id,
            email: updatedDepartment.hod.email,
            firstName: updatedDepartment.hod.firstName,
            lastName: updatedDepartment.hod.lastName,
          }
        : null,
    };
  });
}

module.exports = { createDepartment, updateDepartmentWithHOD, getDepartmentsByTenant };