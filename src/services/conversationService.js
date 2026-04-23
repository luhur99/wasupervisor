const { query } = require('../config/database');
const { CONV_STATE, CONV_EXPIRY_HOURS } = require('../config/constants');
const logger = require('../utils/logger');

async function getState(phoneNumber) {
  const result = await query(
    `SELECT state, context, expires_at FROM conversation_state
     WHERE phone_number = $1`,
    [phoneNumber]
  );
  if (result.rows.length === 0) return { state: CONV_STATE.IDLE, context: {} };

  const row = result.rows[0];
  if (new Date(row.expires_at) < new Date()) {
    await resetState(phoneNumber);
    return { state: CONV_STATE.IDLE, context: {} };
  }
  return { state: row.state, context: row.context || {} };
}

async function setState(phoneNumber, state, context = {}) {
  const expiresAt = new Date(Date.now() + CONV_EXPIRY_HOURS * 60 * 60 * 1000);
  await query(
    `INSERT INTO conversation_state (phone_number, state, context, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (phone_number) DO UPDATE
       SET state = $2, context = $3, expires_at = $4, updated_at = NOW()`,
    [phoneNumber, state, JSON.stringify(context), expiresAt]
  );
}

async function updateContext(phoneNumber, contextUpdate) {
  const current = await getState(phoneNumber);
  const merged = { ...current.context, ...contextUpdate };
  await setState(phoneNumber, current.state, merged);
  return merged;
}

async function resetState(phoneNumber) {
  await query(
    `DELETE FROM conversation_state WHERE phone_number = $1`,
    [phoneNumber]
  );
}

async function cleanupExpired() {
  const result = await query(
    `DELETE FROM conversation_state WHERE expires_at < NOW()`
  );
  if (result.rowCount > 0) {
    logger.info(`Cleaned up ${result.rowCount} expired conversation states`);
  }
}

module.exports = { getState, setState, updateContext, resetState, cleanupExpired };
