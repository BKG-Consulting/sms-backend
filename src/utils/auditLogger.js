const auditLogger = {
  log: (eventType, eventData) => {
    // You can implement DB logging here if needed, or just log to console for now
    console.log(`[AUDIT] ${eventType}:`, eventData);
  }
};

module.exports = auditLogger; 