const express = require('express');
const { getCampuses } = require('../controllers/campus.controller');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Get campuses for current tenant
router.get('/', authenticateToken, getCampuses);

module.exports = router;
