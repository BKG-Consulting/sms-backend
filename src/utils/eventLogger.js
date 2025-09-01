// filepath: src/utils/auditLogger.js
// Audit logger: persists business/audit events to the eventLog table
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const logEvent = async (eventType, eventData) => {
  try {
    await prisma.eventLog.create({
      data: { eventType, eventData: JSON.stringify(eventData) },
    });
  } catch (error) {
    // Optionally, log to main logger if DB logging fails
    // logger.error('Error logging audit event', error);
  }
};

// Provide a logger-like interface for compatibility
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

module.exports = { logEvent, logger };