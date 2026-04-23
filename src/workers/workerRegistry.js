require('dotenv').config();
const cron = require('node-cron');
const { checkConnection } = require('../config/database');
const logger = require('../utils/logger');

const { runMorningReminders, runAfternoonFollowUp, runOverdueCheck } = require('./reminderWorker');
const { runWeeklyReviews, runMonthlyReviews } = require('./reviewWorker');
const { runCleanup } = require('./cleanupWorker');

async function main() {
  try {
    await checkConnection();
    logger.info('Worker process: database connected');
  } catch (err) {
    logger.error('Worker process: database connection failed', { error: err.message });
    process.exit(1);
  }

  const TZ = process.env.TZ || 'Asia/Jakarta';

  // 08:00 WIB — morning reminders for all tasks due today
  cron.schedule('0 8 * * *', runMorningReminders, { timezone: TZ });

  // 13:00 WIB — follow-up for PICs who haven't responded
  cron.schedule('0 13 * * *', runAfternoonFollowUp, { timezone: TZ });

  // 17:00 WIB — mark overdue tasks, alert supervisor
  cron.schedule('0 17 * * *', runOverdueCheck, { timezone: TZ });

  // Monday 07:00 WIB — weekly performance reviews
  cron.schedule('0 7 * * 1', runWeeklyReviews, { timezone: TZ });

  // 1st of month 00:00 WIB — monthly performance reviews
  cron.schedule('0 0 1 * *', runMonthlyReviews, { timezone: TZ });

  // Every 30 minutes — cleanup expired conversation states
  cron.schedule('*/30 * * * *', runCleanup, { timezone: TZ });

  logger.info('All workers registered', {
    schedules: [
      '08:00 WIB — morning reminders',
      '13:00 WIB — afternoon follow-up',
      '17:00 WIB — overdue check',
      'Mon 07:00 WIB — weekly reviews',
      '1st 00:00 WIB — monthly reviews',
      '*/30 min — cleanup',
    ],
  });
}

main();
