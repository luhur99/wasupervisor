const reviewService = require('../services/reviewService');
const { startOfWeekWIB, startOfMonthWIB, todayWIB } = require('../utils/dateUtils');
const dayjs = require('dayjs');
const logger = require('../utils/logger');

async function runWeeklyReviews() {
  logger.info('Weekly review worker started');
  const lastMonday = dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD');
  try {
    await reviewService.generateForAll('weekly', lastMonday);
    logger.info('Weekly reviews complete');
  } catch (err) {
    logger.error('Weekly review worker failed', { error: err.message });
  }
}

async function runMonthlyReviews() {
  logger.info('Monthly review worker started');
  const lastMonthStart = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
  try {
    await reviewService.generateForAll('monthly', lastMonthStart);
    logger.info('Monthly reviews complete');
  } catch (err) {
    logger.error('Monthly review worker failed', { error: err.message });
  }
}

module.exports = { runWeeklyReviews, runMonthlyReviews };
