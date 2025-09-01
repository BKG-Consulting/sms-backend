const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger');

const sessionService = {
  // Create a new session for a user
  createSession: async (userId, token, deviceInfo, ipAddress, userAgent) => {
    try {
      const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours to match token expiry
      
      const session = await prisma.session.create({
        data: {
          userId,
          token,
          deviceInfo,
          ipAddress,
          userAgent,
          expiresAt,
        },
      });

      logger.info('Session created successfully', { userId, sessionId: session.id });
      return session;
    } catch (error) {
      logger.error('Failed to create session', { error: error.message, userId });
      throw error;
    }
  },

  // Get active sessions for a user
  getUserSessions: async (userId) => {
    try {
      const sessions = await prisma.session.findMany({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        orderBy: { lastActivity: 'desc' },
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get user sessions', { error: error.message, userId });
      throw error;
    }
  },

  // Update session activity
  updateSessionActivity: async (token) => {
    try {
      const session = await prisma.session.update({
        where: { token },
        data: { lastActivity: new Date() },
      });

      return session;
    } catch (error) {
      logger.error('Failed to update session activity', { error: error.message, token });
      throw error;
    }
  },

  // Deactivate a session (logout)
  deactivateSession: async (token) => {
    try {
      const session = await prisma.session.update({
        where: { token },
        data: { isActive: false },
      });

      logger.info('Session deactivated', { sessionId: session.id, userId: session.userId });
      return session;
    } catch (error) {
      logger.error('Failed to deactivate session', { error: error.message, token });
      throw error;
    }
  },

  // Deactivate all sessions for a user (force logout from all devices)
  deactivateAllUserSessions: async (userId, excludeToken = null) => {
    try {
      const whereClause = {
        userId,
        isActive: true,
      };

      if (excludeToken) {
        whereClause.token = { not: excludeToken };
      }

      const result = await prisma.session.updateMany({
        where: whereClause,
        data: { isActive: false },
      });

      logger.info('All user sessions deactivated', { userId, count: result.count });
      return result;
    } catch (error) {
      logger.error('Failed to deactivate all user sessions', { error: error.message, userId });
      throw error;
    }
  },

  // Check if user has too many active sessions
  checkSessionLimit: async (userId, maxSessions = 5) => {
    try {
      const activeSessions = await prisma.session.count({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      });

      return {
        withinLimit: activeSessions < maxSessions,
        currentCount: activeSessions,
        maxAllowed: maxSessions,
      };
    } catch (error) {
      logger.error('Failed to check session limit', { error: error.message, userId });
      throw error;
    }
  },

  // Clean up expired sessions
  cleanupExpiredSessions: async () => {
    try {
      const result = await prisma.session.updateMany({
        where: {
          expiresAt: { lt: new Date() },
          isActive: true,
        },
        data: { isActive: false },
      });

      if (result.count > 0) {
        logger.info('Cleaned up expired sessions', { count: result.count });
      }

      return result;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { error: error.message });
      throw error;
    }
  },

  // Get session by token
  getSessionByToken: async (token) => {
    try {
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      });

      return session;
    } catch (error) {
      logger.error('Failed to get session by token', { error: error.message, token });
      throw error;
    }
  },

  // Validate session
  validateSession: async (token) => {
    try {
      const session = await prisma.session.findFirst({
        where: {
          token,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      });

      if (session) {
        // Update last activity
        await sessionService.updateSessionActivity(token);
        return session;
      }

      return null;
    } catch (error) {
      logger.error('Failed to validate session', { error: error.message, token });
      throw error;
    }
  },

  // Update session token (for refresh)
  updateSessionToken: async (oldToken, newToken) => {
    try {
      const session = await prisma.session.update({
        where: { token: oldToken },
        data: { 
          token: newToken,
          expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
          lastActivity: new Date()
        },
      });

      logger.info('Session token updated successfully', { sessionId: session.id });
      return session;
    } catch (error) {
      logger.error('Failed to update session token', { error: error.message, oldToken });
      throw error;
    }
  },
};

module.exports = sessionService; 