const taskService = require('../services/taskService');
const reminderService = require('../services/reminderService');
const cloudchatService = require('../services/cloudchatService');
const logger = require('../utils/logger');

async function runMorningReminders() {
  logger.info('Morning reminder worker started');
  const tasks = await taskService.getTasksDueToday();
  logger.info(`Found ${tasks.length} tasks due today`);

  let sent = 0;
  let failed = 0;
  for (const task of tasks) {
    try {
      await reminderService.sendReminder(task);
      sent++;
    } catch (err) {
      failed++;
      logger.error('Reminder failed', { taskId: task.id, error: err.message });
    }
  }
  logger.info(`Morning reminders complete: ${sent} sent, ${failed} failed`);
}

async function runAfternoonFollowUp() {
  logger.info('Afternoon follow-up reminder worker started');
  const tasks = await taskService.getTasksWithNoResponseToday();
  logger.info(`Found ${tasks.length} tasks with no response yet`);

  for (const task of tasks) {
    try {
      await reminderService.sendReminder(task);
    } catch (err) {
      logger.error('Follow-up reminder failed', { taskId: task.id, error: err.message });
    }
  }
  logger.info('Afternoon follow-up complete');
}

async function runOverdueCheck() {
  logger.info('Overdue check worker started');
  const overdueTasks = await taskService.markOverdue();

  if (overdueTasks.length > 0 && process.env.SUPERVISOR_PHONE) {
    const list = overdueTasks.slice(0, 10).map(t => `• ${t.title}`).join('\n');
    const more = overdueTasks.length > 10 ? `\n...dan ${overdueTasks.length - 10} lainnya` : '';
    const msg = `⏰ *${overdueTasks.length} Tugas Terlambat*\n\n${list}${more}\n\nSegera tindak lanjuti!`;
    await cloudchatService.sendText(process.env.SUPERVISOR_PHONE, msg);
  }
  logger.info(`Overdue check complete: ${overdueTasks.length} tasks marked overdue`);
}

module.exports = { runMorningReminders, runAfternoonFollowUp, runOverdueCheck };
