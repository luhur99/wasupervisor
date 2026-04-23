const { query } = require('../config/database');
const conversationService = require('../services/conversationService');
const logger = require('../utils/logger');

async function runCleanup() {
  await conversationService.cleanupExpired();

  // Archive old audit logs (>90 days)
  const result = await query(
    `DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL '90 days'`
  );
  if (result.rowCount > 0) {
    logger.info(`Archived ${result.rowCount} old audit log entries`);
  }
}

module.exports = { runCleanup };
