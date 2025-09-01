const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger');

// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 50,         // Change this value to adjust the rate limit
};

const securityService = {
  // Track login attempt
  trackLoginAttempt: async (email, ipAddress, userAgent, success, userId = null) => {
    try {
      const attempt = await prisma.loginAttempt.create({
        data: {
          email,
          ipAddress,
          userAgent,
          success,
          userId,
        },
      });

      logger.info('Login attempt tracked', { 
        email, 
        ipAddress, 
        success, 
        attemptId: attempt.id 
      });

      return attempt;
    } catch (error) {
      logger.error('Failed to track login attempt', { error: error.message, email });
      throw error;
    }
  },

  // Check if account is locked out
  checkAccountLockout: async (email, ipAddress) => {
    try {
      const now = new Date();
      const lockoutWindow = 15 * 60 * 1000; // 15 minutes
      const maxAttempts = 5;

      // Check for recent failed attempts
      const recentFailedAttempts = await prisma.loginAttempt.count({
        where: {
          email,
          success: false,
          attemptTime: { gte: new Date(now.getTime() - lockoutWindow) },
        },
      });

      // Check for recent lockout
      const recentLockout = await prisma.loginAttempt.findFirst({
        where: {
          email,
          lockoutExpiresAt: { gt: now },
        },
        orderBy: { attemptTime: 'desc' },
      });

      if (recentLockout) {
        const remainingTime = Math.ceil((recentLockout.lockoutExpiresAt.getTime() - now.getTime()) / 1000);
        return {
          isLocked: true,
          remainingSeconds: remainingTime,
          reason: 'Account temporarily locked due to multiple failed login attempts',
        };
      }

      if (recentFailedAttempts >= maxAttempts) {
        // Create lockout
        await prisma.loginAttempt.create({
          data: {
            email,
            ipAddress,
            success: false,
            lockoutExpiresAt: new Date(now.getTime() + lockoutWindow),
          },
        });

        logger.warn('Account locked due to multiple failed attempts', { email, ipAddress });
        return {
          isLocked: true,
          remainingSeconds: lockoutWindow / 1000,
          reason: 'Account temporarily locked due to multiple failed login attempts',
        };
      }

      return {
        isLocked: false,
        remainingAttempts: maxAttempts - recentFailedAttempts,
      };
    } catch (error) {
      logger.error('Failed to check account lockout', { error: error.message, email });
      throw error;
    }
  },

  // Check IP-based rate limiting
  checkIPRateLimit: async (ipAddress) => {
    try {
      const now = new Date();
      const { windowMs, maxAttempts } = RATE_LIMIT_CONFIG;
      const windowStart = new Date(now.getTime() - windowMs);
      const recentAttempts = await prisma.loginAttempt.count({
        where: {
          ipAddress,
          attemptTime: { gte: windowStart },
        },
      });

      if (recentAttempts >= maxAttempts) {
        // Calculate seconds until window resets
        const oldestAttempt = await prisma.loginAttempt.findFirst({
          where: {
            ipAddress,
            attemptTime: { gte: windowStart },
          },
          orderBy: { attemptTime: 'asc' },
        });
        let retryAfterSeconds = Math.ceil((windowMs - (now.getTime() - oldestAttempt.attemptTime.getTime())) / 1000);
        if (retryAfterSeconds < 0) retryAfterSeconds = 0;
        logger.warn('IP rate limit exceeded', { ipAddress, attempts: recentAttempts, retryAfterSeconds });
        return {
          isRateLimited: true,
          reason: 'Too many login attempts from this IP address',
          resetTime: new Date(oldestAttempt.attemptTime.getTime() + windowMs),
          retryAfterSeconds,
        };
      }

      return {
        isRateLimited: false,
        remainingAttempts: maxAttempts - recentAttempts,
      };
    } catch (error) {
      logger.error('Failed to check IP rate limit', { error: error.message, ipAddress });
      throw error;
    }
  },

  // Clear failed attempts after successful login
  clearFailedAttempts: async (email) => {
    try {
      const result = await prisma.loginAttempt.updateMany({
        where: {
          email,
          success: false,
        },
        data: {
          lockoutExpiresAt: null,
        },
      });

      logger.info('Cleared failed login attempts', { email, count: result.count });
      return result;
    } catch (error) {
      logger.error('Failed to clear failed attempts', { error: error.message, email });
      throw error;
    }
  },

  // Get login attempt statistics
  getLoginAttemptStats: async (email, hours = 24) => {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const stats = await prisma.loginAttempt.groupBy({
        by: ['success'],
        where: {
          email,
          attemptTime: { gte: since },
        },
        _count: {
          success: true,
        },
      });

      const successful = stats.find(s => s.success)?._count.success || 0;
      const failed = stats.find(s => !s.success)?._count.success || 0;

      return {
        successful,
        failed,
        total: successful + failed,
        period: `${hours} hours`,
      };
    } catch (error) {
      logger.error('Failed to get login attempt stats', { error: error.message, email });
      throw error;
    }
  },

  // Clean up old login attempts (older than 30 days)
  cleanupOldLoginAttempts: async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const result = await prisma.loginAttempt.deleteMany({
        where: {
          attemptTime: { lt: thirtyDaysAgo },
        },
      });

      if (result.count > 0) {
        logger.info('Cleaned up old login attempts', { count: result.count });
      }

      return result;
    } catch (error) {
      logger.error('Failed to cleanup old login attempts', { error: error.message });
      throw error;
    }
  },
};

module.exports = securityService; 