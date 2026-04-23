const { query } = require('../../config/database');

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
    const { task_id, user_id, date_from, date_to, flagged, page = 1, limit = 20 } = req.query;
    const pagination = getPagination(page, limit, 20, 100);
    const conditions = [];
    const params = [];
    let p = 1;

    if (task_id) { conditions.push(`tr.task_id = $${p++}`); params.push(task_id); }
    if (user_id) { conditions.push(`tr.user_id = $${p++}`); params.push(user_id); }
    if (date_from) { conditions.push(`tr.response_date >= $${p++}`); params.push(date_from); }
    if (date_to) { conditions.push(`tr.response_date <= $${p++}`); params.push(date_to); }
    if (flagged !== undefined) { conditions.push(`tr.flagged = $${p++}`); params.push(flagged === 'true'); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(`SELECT COUNT(*) FROM task_responses tr ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(pagination.limit, pagination.offset);
    const result = await query(
      `SELECT tr.*, t.title AS task_title, u.full_name AS pic_name,
              c.name AS category_name
       FROM task_responses tr
       LEFT JOIN tasks t ON t.id = tr.task_id
       LEFT JOIN users u ON u.id = tr.user_id
       LEFT JOIN task_categories c ON c.id = t.category_id
       ${where}
       ORDER BY tr.created_at DESC
       LIMIT $${p++} OFFSET $${p++}`,
      params
    );

    res.json({ data: result.rows, meta: { total, page: pagination.page, limit: pagination.limit } });
  } catch (err) { next(err); }
};

const get = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT tr.*, t.title AS task_title, t.description AS task_description,
              u.full_name AS pic_name, u.phone_number AS pic_phone,
              c.name AS category_name
       FROM task_responses tr
       LEFT JOIN tasks t ON t.id = tr.task_id
       LEFT JOIN users u ON u.id = tr.user_id
       LEFT JOIN task_categories c ON c.id = t.category_id
       WHERE tr.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Response not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

module.exports = { list, get };
