const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Jakarta';

function nowWIB() {
  return dayjs().tz(TZ);
}

function todayWIB() {
  return nowWIB().format('YYYY-MM-DD');
}

function toWIB(date) {
  return dayjs(date).tz(TZ);
}

function startOfWeekWIB() {
  return nowWIB().startOf('week').format('YYYY-MM-DD');
}

function endOfWeekWIB() {
  return nowWIB().endOf('week').format('YYYY-MM-DD');
}

function startOfMonthWIB() {
  return nowWIB().startOf('month').format('YYYY-MM-DD');
}

function endOfMonthWIB() {
  return nowWIB().endOf('month').format('YYYY-MM-DD');
}

module.exports = { nowWIB, todayWIB, toWIB, startOfWeekWIB, endOfWeekWIB, startOfMonthWIB, endOfMonthWIB, TZ };
