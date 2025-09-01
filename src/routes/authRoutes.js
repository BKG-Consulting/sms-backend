const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/register', authenticateToken, authController.register);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.post('/verifyOTP', authController.verifyOTP);
router.post('/resendOTP', authController.resendOTP);
router.post('/forgotPassword', authController.forgotPassword);
router.post('/resetPassword', authController.resetPassword);
router.post('/refresh-session', authenticateToken, authController.refreshSession);

module.exports = router;