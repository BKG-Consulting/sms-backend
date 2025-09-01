// src/middleware/errorMiddleware.js
const { logger } = require('../utils/logger');

const errorMiddleware = (error, req, res, next) => {
  const status = error.status || 500;
  const message = error.message || 'Internal server error';
  const code = error.code || 'SERVER_ERROR';
  logger.error(message, { status, code, stack: error.stack });
  res.status(status).json({ error: { message, code } });
};

module.exports = errorMiddleware;