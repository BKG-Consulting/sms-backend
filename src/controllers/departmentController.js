const { prisma } = require('../../prisma/client');
const { createDepartment: createDepartmentService, updateDepartmentWithHOD, getDepartmentsByTenant } = require('../services/department.service');
const roleRepository = require('../repositories/roleRepository');
const { createUser } = require('../services/userService');

const createDepartment = async (req, res, next) => {
  try {
    // 1. Extract department info from payload (no HOD logic)
    const { name, code, campusId } = req.body;
    const tenantId = req.user.tenantId; // Extract tenantId from authenticated user
    const createdBy = req.user.userId;

    if (!tenantId) {
      return res.status(400).json({ 
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    // 2. Create department (no HOD logic)
    const department = await createDepartmentService({
      name,
      code,
      campusId,
      tenantId,
      createdBy,
    });

    res.status(201).json({
      department: {
        id: department.id,
        name: department.name,
        code: department.code,
        campusId: department.campusId,
        tenantId: department.tenantId,
        isActive: true,
        createdAt: department.createdAt,
        updatedAt: department.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params; // department id
    const { name, code, head } = req.body;
    const tenantId = req.user.tenantId; // or from req.body
    const updatedBy = req.user.userId;

    const result = await updateDepartmentWithHOD({
      departmentId: id,
      name,
      code,
      head, // { userId, email, firstName, lastName, password } or null
      tenantId,
      updatedBy,
    });

    res.status(200).json({ department: { ...result, isActive: true } });
  } catch (error) {
    next(error);
  }
};

const getDepartments = async (req, res, next) => {
  try {
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      return res.status(400).json({
        message: 'Tenant ID not found in user context',
        error: 'Missing tenant context'
      });
    }

    const departments = await getDepartmentsByTenant(tenantId);

    res.json({
      message: 'Departments fetched successfully',
      departments: departments.map(d => ({ ...d, isActive: true })),
      count: departments.length
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /departments/:id/hod
const setHOD = async (req, res, next) => {
  try {
    const { id } = req.params; // department id
    const { hodId } = req.body;
    if (!hodId) return res.status(400).json({ message: 'hodId is required' });

    // Fetch user and department
    const user = await prisma.user.findUnique({
      where: { id: hodId },
      include: {
        userRoles: { include: { role: true } },
        userDepartmentRoles: { include: { department: true, role: true } },
      }
    });
    const department = await prisma.department.findUnique({ where: { id } });

    if (!user || !department) return res.status(404).json({ message: 'User or Department not found' });
    // Check if user is a member of this department via userDepartmentRoles
    const isMember = user.userDepartmentRoles.some(udr => udr.department && udr.department.id === id);
    if (!isMember) return res.status(400).json({ message: 'User is not a member of this department' });
    const hasHodRole = user.userRoles.some(ur => ur.role.name && ur.role.name.trim().toUpperCase() === 'HOD');
    if (!hasHodRole) return res.status(400).json({ message: 'User does not have the HOD role' });

    // Set as HOD
    const updated = await prisma.department.update({
      where: { id },
      data: { hodId }
    });

    res.status(200).json({ message: 'HOD updated', department: { ...updated, isActive: true } });
  } catch (error) {
    next(error);
  }
};

module.exports = { createDepartment, updateDepartment, getDepartments, setHOD };