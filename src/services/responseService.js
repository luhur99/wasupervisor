const { query } = require('../config/database');
const logger = require('../utils/logger');

async function save({ taskId, userId, messageText, statusReported, photoUrls = [], waMessageId }) {
  const result = await query(
    `INSERT INTO task_responses
       (task_id, user_id, message_text, status_reported, photo_urls, wa_message_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [taskId, userId, messageText || null, statusReported || null,
     photoUrls.length ? photoUrls : '{}', waMessageId || null]
  );
  const response = result.rows[0];
  logger.info('Task response saved', { responseId: response.id, taskId, userId });

  // Trigger async AI analysis without blocking
  setImmediate(async () => {
    try {
      const agent = require('../agent/agent');
      await agent.analyzeResponse(response.id);
    } catch (err) {
      logger.error('AI response analysis failed', { responseId: response.id, error: err.message });
    }
  });

  return response;
}

async function updateAiAnalysis(responseId, { aiSummary, flagged, flagReason, suggestedStatus }) {
  await query(
    `UPDATE task_responses
     SET ai_summary = $1, flagged = $2, flag_reason = $3
     WHERE id = $4`,
    [aiSummary, flagged, flagReason || null, responseId]
  );

  if (suggestedStatus) {
    const response = await query('SELECT task_id FROM task_responses WHERE id = $1', [responseId]);
    if (response.rows.length > 0) {
      await query(
        `UPDATE tasks SET status = $1, updated_at = NOW()
         WHERE id = $2 AND deleted_at IS NULL`,
        [suggestedStatus, response.rows[0].task_id]
      );
    }
  }
}

module.exports = { save, updateAiAnalysis };
