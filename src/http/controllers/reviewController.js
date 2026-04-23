const { query } = require('../../config/database');
const logger = require('../../utils/logger');

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
    const { user_id, period, period_start, page = 1, limit = 20 } = req.query;
    const pagination = getPagination(page, limit, 20, 100);
    const conditions = [];
    const params = [];
    let p = 1;

    if (user_id) { conditions.push(`pr.user_id = $${p++}`); params.push(user_id); }
    if (period) { conditions.push(`pr.period = $${p++}`); params.push(period); }
    if (period_start) { conditions.push(`pr.period_start = $${p++}`); params.push(period_start); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(`SELECT COUNT(*) FROM performance_reviews pr ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(pagination.limit, pagination.offset);
    const result = await query(
      `SELECT pr.*, u.full_name AS pic_name, u.department
       FROM performance_reviews pr
       LEFT JOIN users u ON u.id = pr.user_id
       ${where}
       ORDER BY pr.period_start DESC
       LIMIT $${p++} OFFSET $${p++}`,
      params
    );

    res.json({ data: result.rows, meta: { total, page: pagination.page, limit: pagination.limit } });
  } catch (err) { next(err); }
};

const get = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT pr.*, u.full_name AS pic_name, u.department, u.phone_number
       FROM performance_reviews pr
       LEFT JOIN users u ON u.id = pr.user_id
       WHERE pr.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Review not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

const generate = async (req, res, next) => {
  try {
    const { user_id, period = 'weekly', period_start } = req.body;
    if (!period_start) return res.status(400).json({ error: 'period_start is required' });

    setImmediate(async () => {
      try {
        const reviewService = require('../../services/reviewService');
        if (user_id) {
          await reviewService.generateForUser(user_id, period, period_start);
        } else {
          await reviewService.generateForAll(period, period_start);
        }
      } catch (err) {
        logger.error('Background review generation failed', { error: err.message });
      }
    });

    res.json({ status: 'queued', message: 'Review generation started in background' });
  } catch (err) { next(err); }
};

module.exports = { list, get, generate };
