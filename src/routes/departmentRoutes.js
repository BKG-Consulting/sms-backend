const express = require('express');

const { createDepartment, updateDepartment, getDepartments, setHOD } = require('../controllers/departmentController');
const { authenticateToken, restrictTo } = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/', authenticateToken, restrictTo(['SYSTEM_ADMIN']), createDepartment);
router.put('/:id', authenticateToken, restrictTo(['SYSTEM_ADMIN']), updateDepartment);
router.get('/', authenticateToken, getDepartments);
router.patch('/:id/hod', authenticateToken, restrictTo(['SYSTEM_ADMIN']), setHOD);
// router.get('/:id', authenticateToken, getDepartment);
// router.delete('/:id', authenticateToken, restrictTo(['SYSTEM_ADMIN']), deleteDepartment);

module.exports = router;