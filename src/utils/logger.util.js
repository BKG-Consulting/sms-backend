const logger = {
  debug: (message, meta) => console.debug(`DEBUG: ${message}`, meta || ''),
  info: (message, meta) => console.log(`INFO: ${message}`, meta || ''),
  warn: (message, meta) => console.warn(`WARN: ${message}`, meta || ''),
  error: (message, error) => console.error(`ERROR: ${message}`, error),
};

module.exports = { logger };