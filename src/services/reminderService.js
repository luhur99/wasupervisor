const { query } = require('../config/database');
const cloudchatService = require('./cloudchatService');
const agent = require('../agent/agent');
const logger = require('../utils/logger');

async function getResponseCountThisWeek(taskId, userId) {
  const result = await query(
    `SELECT COUNT(*) FROM task_responses
     WHERE task_id = $1 AND user_id = $2
       AND response_date >= date_trunc('week', CURRENT_DATE)`,
    [taskId, userId]
  );
  return parseInt(result.rows[0].count);
}

async function getReminderCountToday(taskId, userId) {
  const result = await query(
    `SELECT COUNT(*) FROM reminder_log
     WHERE task_id = $1 AND user_id = $2
       AND scheduled_for >= CURRENT_DATE
       AND status = 'sent'`,
    [taskId, userId]
  );
  return parseInt(result.rows[0].count);
}

async function sendReminder(task) {
  if (!task.pic_phone || !task.assigned_to) {
    logger.warn('sendReminder: task has no assigned PIC with phone', { taskId: task.id });
    return null;
  }

  // Log as queued
  const logResult = await query(
    `INSERT INTO reminder_log (task_id, user_id, status, scheduled_for)
     VALUES ($1, $2, 'queued', NOW()) RETURNING id`,
    [task.id, task.assigned_to]
  );
  const reminderId = logResult.rows[0].id;

  try {
    const responseCount = await getResponseCountThisWeek(task.id, task.assigned_to);
    const message = await agent.generateReminder(task, responseCount);

    const result = await cloudchatService.sendButton(task.pic_phone, {
      title: message.header,
      text: message.body,
      footer: message.footer,
      buttons: message.buttons,
    });

    const waMessageId = result?.message_id || null;
    await query(
      `UPDATE reminder_log
       SET status = 'sent', wa_message_id = $1, message_preview = $2, sent_at = NOW()
       WHERE id = $3`,
      [waMessageId, message.body?.substring(0, 200), reminderId]
    );

    logger.info('Reminder sent', { reminderId, taskId: task.id, to: task.pic_phone });
    return reminderId;
  } catch (err) {
    await query(
      `UPDATE reminder_log SET status = 'failed', error_message = $1 WHERE id = $2`,
      [err.message?.substring(0, 500), reminderId]
    );
    logger.error('Reminder send failed', { reminderId, taskId: task.id, error: err.message });
    return reminderId;
  }
}

module.exports = { sendReminder, getResponseCountThisWeek };
