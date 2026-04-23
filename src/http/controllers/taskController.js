const { query } = require('../../config/database');
const { todayWIB } = require('../../utils/dateUtils');

function getPagination(page, limit, defaultLimit = 20, maxLimit = 100) {
  const pageNum = Number.parseInt(page, 10);
  const limitNum = Number.parseInt(limit, 10);

  const safePage = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;
  const parsedLimit = Number.isInteger(limitNum) && limitNum > 0 ? limitNum : defaultLimit;
  const safeLimit = Math.min(parsedLimit, maxLimit);

  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
}

const list = async (req, res, next) => {
  try {
    const { status, assigned_to, category_id, due_date_from, due_date_to, page = 1, limit = 20 } = req.query;
    const pagination = getPagination(page, limit, 20, 100);
    const conditions = ['t.deleted_at IS NULL'];
    const params = [];
    let p = 1;

    if (status) { conditions.push(`t.status = $${p++}`); params.push(status); }
    if (assigned_to) { conditions.push(`t.assigned_to = $${p++}`); params.push(assigned_to); }
    if (category_id) { conditions.push(`t.category_id = $${p++}`); params.push(parseInt(category_id)); }
    if (due_date_from) { conditions.push(`t.due_date >= $${p++}`); params.push(due_date_from); }
    if (due_date_to) { conditions.push(`t.due_date <= $${p++}`); params.push(due_date_to); }

    const where = 'WHERE ' + conditions.join(' AND ');

    const countResult = await query(`SELECT COUNT(*) FROM tasks t ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(pagination.limit, pagination.offset);
    const result = await query(
      `SELECT t.*, c.name AS category_name, c.color_hex,
              u.full_name AS pic_name, u.phone_number AS pic_phone
       FROM tasks t
       LEFT JOIN task_categories c ON c.id = t.category_id
       LEFT JOIN users u ON u.id = t.assigned_to
       ${where}
       ORDER BY t.due_date ASC, t.priority DESC
       LIMIT $${p++} OFFSET $${p++}`,
      params
    );

    res.json({ data: result.rows, meta: { total, page: pagination.page, limit: pagination.limit } });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const {
      title, description, category_id, assigned_to, created_by, priority = 'medium',
      due_date, due_time, recurrence, recurrence_end, location,
      checklist, custom_fields, send_reminder = true, reminder_hour = 8,
    } = req.body;

    if (!title || !due_date) {
      return res.status(400).json({ error: 'title and due_date are required' });
    }

    const result = await query(
      `INSERT INTO tasks
         (title, description, category_id, assigned_to, created_by, priority, due_date,
          due_time, recurrence, recurrence_end, location, checklist, custom_fields,
          send_reminder, reminder_hour)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        title, description || null, category_id || null, assigned_to || null,
        created_by || null,
        priority, due_date, due_time || null, recurrence || null,
        recurrence_end || null, location || null,
        JSON.stringify(checklist || []), JSON.stringify(custom_fields || {}),
        send_reminder, reminder_hour,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
};

const get = async (req, res, next) => {
  try {
    const taskResult = await query(
      `SELECT t.*, c.name AS category_name, c.color_hex,
              u.full_name AS pic_name, u.phone_number AS pic_phone
       FROM tasks t
       LEFT JOIN task_categories c ON c.id = t.category_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [req.params.id]
    );
    if (taskResult.rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    const responsesResult = await query(
      `SELECT tr.*, u.full_name AS pic_name
       FROM task_responses tr
       LEFT JOIN users u ON u.id = tr.user_id
       WHERE tr.task_id = $1
       ORDER BY tr.created_at DESC
       LIMIT 10`,
      [req.params.id]
    );

    res.json({ ...taskResult.rows[0], responses: responsesResult.rows });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const {
      title, description, category_id, assigned_to, status, priority,
      due_date, due_time, recurrence, recurrence_end, location,
      checklist, custom_fields, send_reminder, reminder_hour,
    } = req.body;

    const result = await query(
      `UPDATE tasks SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         category_id = COALESCE($3, category_id),
         assigned_to = COALESCE($4, assigned_to),
         status = COALESCE($5, status),
         priority = COALESCE($6, priority),
         due_date = COALESCE($7, due_date),
         due_time = COALESCE($8, due_time),
         recurrence = COALESCE($9, recurrence),
         recurrence_end = COALESCE($10, recurrence_end),
         location = COALESCE($11, location),
         checklist = COALESCE($12, checklist),
         custom_fields = COALESCE($13, custom_fields),
         send_reminder = COALESCE($14, send_reminder),
         reminder_hour = COALESCE($15, reminder_hour),
         updated_at = NOW()
       WHERE id = $16 AND deleted_at IS NULL
       RETURNING *`,
      [
        title, description, category_id, assigned_to, status, priority,
        due_date, due_time, recurrence, recurrence_end, location,
        checklist ? JSON.stringify(checklist) : null,
        custom_fields ? JSON.stringify(custom_fields) : null,
        send_reminder, reminder_hour,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE tasks SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) { next(err); }
};

const remindNow = async (req, res, next) => {
  try {
    const taskResult = await query(
      `SELECT t.*, u.phone_number AS pic_phone, u.full_name AS pic_name
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [req.params.id]
    );
    if (taskResult.rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    const task = taskResult.rows[0];
    if (!task.pic_phone) return res.status(400).json({ error: 'Task has no assigned PIC with phone' });

    const reminderService = require('../../services/reminderService');
    const reminderId = await reminderService.sendReminder(task);
    res.json({ queued: true, reminder_id: reminderId });
  } catch (err) { next(err); }
};

module.exports = { list, create, get, update, remove, remindNow };
