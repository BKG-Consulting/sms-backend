const { z } = require('zod');
const authService = require('../services/authService');
const { logger } = require('../utils/logger');

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  }),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  tenantId: z.string().uuid(),
  roleIds: z.array(z.string().uuid()).optional(),
  departmentId: z.string().uuid().optional(),
  tenantName: z.string().min(1).optional(),
});

const otpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

const authController = {
  register: async (req, res, next) => {
    try {
      const { email, password, firstName, lastName, tenantId, roleIds, departmentId, tenantName } = registerSchema.parse(req.body);
      const createdBy = req.user.userId; // From authMiddleware
      await authService.registerUser({
        email,
        password,
        firstName,
        lastName,
        tenantId,
        roleIds,
        departmentId,
        tenantName,
        createdBy,
      });
      logger.info('User registered successfully, OTP sent', { email, createdBy });
      res.status(201).json({ message: 'User registered successfully. Please verify your email with the OTP sent.' });
    } catch (error) {
      next(error);
    }
  },

  login: async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      const userAgent = req.headers['user-agent'];

      const result = await authService.loginUser(email, password, ipAddress, userAgent);
      if (result.requiresVerification) {
        logger.info('OTP sent for unverified email', { email });
        return res.status(200).json(result);
      }
      const { accessToken, refreshToken, user, sessionInfo } = result;
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      logger.info('User logged in successfully', { userId: user.id, email, sessionInfo });
      res.json({ accessToken, user, sessionInfo });
    } catch (error) {
      if (error.code === 'RATE_LIMITED') {
        logger.warn('Rate limit hit for login', { email: req.body?.email, ip: req.ip });
        return res.status(429).json({ error: { message: error.message, code: error.code } });
      }
      next(error);
    }
  },

  refreshToken: async (req, res, next) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        throw new Error('No refresh token provided');
      }
      const { accessToken, newRefreshToken } = await authService.refreshAccessToken(refreshToken);
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      logger.info('Access token refreshed successfully', { refreshToken: refreshToken.substring(0, 10) + '...' });
      res.json({ accessToken });
    } catch (error) {
      if (error.code === 'P2002') {
        logger.error('Duplicate refresh token detected in refresh', { error: error.message });
        return res.status(500).json({ error: { message: 'Failed to refresh token due to duplicate', code: 'TOKEN_DUPLICATE' } });
      }
      next(error);
    }
  },

  logout: async (req, res, next) => {
    try {
      const refreshToken = req.cookies.refreshToken;
      const accessToken = req.headers.authorization?.split(' ')[1];

      if (refreshToken) {
        await authService.deleteRefreshToken(refreshToken);
        res.clearCookie('refreshToken', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Strict',
        });
      }

      // Deactivate session
      if (accessToken) {
        await authService.logoutUser(accessToken);
      }

      logger.info('User logged out successfully');
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  },

  verifyOTP: async (req, res, next) => {
    try {
      const { email, otp } = otpSchema.parse(req.body);
      await authService.verifyOTP(email, otp);
      logger.info('Account verified successfully', { email });
      res.json({ message: 'Account verified successfully' });
    } catch (error) {
      next(error);
    }
  },

  resendOTP: async (req, res, next) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      await authService.resendOTP(email);
      logger.info('OTP resent successfully', { email });
      res.json({ message: 'OTP resent successfully' });
    } catch (error) {
      next(error);
    }
  },

  forgotPassword: async (req, res, next) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const token = await authService.forgotPassword(email);
      const resetLink = `${process.env.CLIENT_URL}/auth/reset-password?token=${token}`;
      await authService.sendPasswordResetEmail(email, resetLink);
      logger.info('Password reset link sent', { email });
      res.json({ message: 'Password reset link sent to your email' });
    } catch (error) {
      next(error);
    }
  },

  resetPassword: async (req, res, next) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      await authService.resetPassword(token, password);
      logger.info('Password reset successfully', { token: token.substring(0, 10) + '...' });
      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      next(error);
    }
  },

  refreshSession: async (req, res, next) => {
    try {
      const accessToken = req.headers.authorization?.split(' ')[1];
      const result = await authService.refreshSession(accessToken);
      logger.info('Session refreshed successfully', { userId: req.user.userId });
      res.json({ 
        message: 'Session refreshed successfully',
        accessToken: result.accessToken,
        expiresIn: result.expiresIn 
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = authController;