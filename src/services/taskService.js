const { query } = require('../config/database');
const { TASK_STATUS } = require('../config/constants');
const { todayWIB } = require('../utils/dateUtils');
const logger = require('../utils/logger');

async function getTasksDueToday() {
  const today = todayWIB();
  const result = await query(
    `SELECT t.*, c.name AS category_name,
            u.full_name AS pic_name, u.phone_number AS pic_phone
     FROM tasks t
     LEFT JOIN task_categories c ON c.id = t.category_id
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.due_date = $1
       AND t.send_reminder = TRUE
       AND t.status IN ('pending', 'in_progress')
       AND t.deleted_at IS NULL
       AND u.is_active = TRUE
       AND u.phone_number IS NOT NULL`,
    [today]
  );
  return result.rows;
}

async function getTasksWithNoResponseToday() {
  const today = todayWIB();
  const result = await query(
    `SELECT t.*, c.name AS category_name,
            u.full_name AS pic_name, u.phone_number AS pic_phone
     FROM tasks t
     LEFT JOIN task_categories c ON c.id = t.category_id
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.due_date = $1
       AND t.send_reminder = TRUE
       AND t.status IN ('pending', 'in_progress')
       AND t.deleted_at IS NULL
       AND u.is_active = TRUE
       AND u.phone_number IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM task_responses tr
         WHERE tr.task_id = t.id AND tr.response_date = $1
       )`,
    [today]
  );
  return result.rows;
}

async function getTasksByPhone(phoneNumber) {
  const today = todayWIB();
  const result = await query(
    `SELECT t.*, c.name AS category_name
     FROM tasks t
     LEFT JOIN task_categories c ON c.id = t.category_id
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE u.phone_number = $1
       AND t.due_date = $2
       AND t.status IN ('pending', 'in_progress')
       AND t.deleted_at IS NULL`,
    [phoneNumber, today]
  );
  return result.rows;
}

async function markOverdue() {
  const today = todayWIB();
  const result = await query(
    `UPDATE tasks SET status = 'overdue', updated_at = NOW()
     WHERE due_date < $1
       AND status IN ('pending', 'in_progress')
       AND deleted_at IS NULL
     RETURNING id, title, assigned_to`,
    [today]
  );
  if (result.rowCount > 0) {
    logger.info(`Marked ${result.rowCount} tasks as overdue`);
  }
  return result.rows;
}

async function updateStatus(taskId, status) {
  await query(
    'UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL',
    [status, taskId]
  );
}

module.exports = { getTasksDueToday, getTasksWithNoResponseToday, getTasksByPhone, markOverdue, updateStatus };
