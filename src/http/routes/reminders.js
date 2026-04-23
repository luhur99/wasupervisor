const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/auth');
const { query } = require('../../config/database');

router.use(apiKeyAuth);

router.get('/', async (req, res, next) => {
  try {
    const { status, task_id, user_id, date_from, date_to, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    let p = 1;

    if (status) { conditions.push(`rl.status = $${p++}`); params.push(status); }
    if (task_id) { conditions.push(`rl.task_id = $${p++}`); params.push(task_id); }
    if (user_id) { conditions.push(`rl.user_id = $${p++}`); params.push(user_id); }
    if (date_from) { conditions.push(`rl.scheduled_for >= $${p++}`); params.push(date_from); }
    if (date_to) { conditions.push(`rl.scheduled_for <= $${p++}`); params.push(date_to); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query(`SELECT COUNT(*) FROM reminder_log rl ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT rl.*, t.title as task_title, u.full_name as pic_name
       FROM reminder_log rl
       LEFT JOIN tasks t ON t.id = rl.task_id
       LEFT JOIN users u ON u.id = rl.user_id
       ${where}
       ORDER BY rl.scheduled_for DESC
       LIMIT $${p++} OFFSET $${p++}`,
      params
    );

    res.json({ data: result.rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
});

module.exports = router;
