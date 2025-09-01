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
          successful: success,
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
          successful: false,
          createdAt: { gte: new Date(now.getTime() - lockoutWindow) },
        },
      });

      // Simplified lockout check - just count recent failed attempts

      if (recentFailedAttempts >= maxAttempts) {
        // Log lockout (no database field for lockout expiry)
        logger.warn('Account would be locked due to multiple failed attempts', { email, ipAddress });

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
          createdAt: { gte: windowStart },
        },
      });

      if (recentAttempts >= maxAttempts) {
        // Calculate seconds until window resets
        const oldestAttempt = await prisma.loginAttempt.findFirst({
          where: {
            ipAddress,
            createdAt: { gte: windowStart },
          },
          orderBy: { createdAt: 'asc' },
        });
        let retryAfterSeconds = Math.ceil((windowMs - (now.getTime() - oldestAttempt.createdAt.getTime())) / 1000);
        if (retryAfterSeconds < 0) retryAfterSeconds = 0;
        logger.warn('IP rate limit exceeded', { ipAddress, attempts: recentAttempts, retryAfterSeconds });
        return {
          isRateLimited: true,
          reason: 'Too many login attempts from this IP address',
          resetTime: new Date(oldestAttempt.createdAt.getTime() + windowMs),
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
      // For now, just log that we would clear failed attempts
      // In a full implementation, you might want to add a lockoutExpiresAt field to the schema
      logger.info('Would clear failed login attempts', { email });
      return { count: 0 };

      logger.info('Cleared failed login attempts', { email, count: 0 });
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
        by: ['successful'],
        where: {
          email,
          createdAt: { gte: since },
        },
        _count: {
          successful: true,
        },
      });

      const successful = stats.find(s => s.successful)?._count.successful || 0;
      const failed = stats.find(s => !s.successful)?._count.successful || 0;

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
          createdAt: { lt: thirtyDaysAgo },
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