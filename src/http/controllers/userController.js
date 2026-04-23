const { query } = require('../../config/database');
const { normalizePhone, isValidPhone } = require('../../utils/phoneUtils');

function getPagination(page, limit, defaultLimit = 50, maxLimit = 100) {
  const pageNum = Number.parseInt(page, 10);
  const limitNum = Number.parseInt(limit, 10);

  const safePage = Number.isInteger(pageNum) && pageNum > 0 ? pageNum : 1;
  const parsedLimit = Number.isInteger(limitNum) && limitNum > 0 ? limitNum : defaultLimit;
  const safeLimit = Math.min(parsedLimit, maxLimit);

  return { page: safePage, limit: safeLimit, offset: (safePage - 1) * safeLimit };
}

const list = async (req, res, next) => {
  try {
    const { role, is_active, department, page = 1, limit = 50 } = req.query;
    const pagination = getPagination(page, limit, 50, 100);
    const conditions = [];
    const params = [];
    let p = 1;

    if (role) { conditions.push(`role = $${p++}`); params.push(role); }
    if (is_active !== undefined) { conditions.push(`is_active = $${p++}`); params.push(is_active === 'true'); }
    if (department) { conditions.push(`department ILIKE $${p++}`); params.push(`%${department}%`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query(`SELECT COUNT(*) FROM users ${where}`, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(pagination.limit, pagination.offset);
    const result = await query(
      `SELECT id, full_name, phone_number, email, role, department, is_active, created_at
       FROM users ${where}
       ORDER BY full_name
       LIMIT $${p++} OFFSET $${p++}`,
      params
    );

    res.json({ data: result.rows, meta: { total, page: pagination.page, limit: pagination.limit } });
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const { full_name, phone_number, email, role = 'pic', department } = req.body;
    if (!full_name || !phone_number) {
      return res.status(400).json({ error: 'full_name and phone_number are required' });
    }

    const phone = normalizePhone(phone_number);
    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const result = await query(
      `INSERT INTO users (full_name, phone_number, email, role, department)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [full_name, phone, email || null, role, department || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone number already registered' });
    next(err);
  }
};

const get = async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

const stats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [tasksResult, responsesResult] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status != 'cancelled') AS tasks_assigned,
           COUNT(*) FILTER (WHERE status = 'completed') AS tasks_completed,
           COUNT(*) FILTER (WHERE status = 'overdue') AS tasks_overdue,
           COUNT(*) FILTER (WHERE status = 'pending' OR status = 'in_progress') AS tasks_pending
         FROM tasks WHERE assigned_to = $1 AND deleted_at IS NULL`,
        [id]
      ),
      query(
        `SELECT
           COUNT(*) AS total_responses,
           COUNT(*) FILTER (WHERE flagged = TRUE) AS flagged_responses
         FROM task_responses WHERE user_id = $1`,
        [id]
      ),
    ]);
    res.json({ ...tasksResult.rows[0], ...responsesResult.rows[0] });
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const { full_name, email, role, department, is_active } = req.body;
    const result = await query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           email = COALESCE($2, email),
           role = COALESCE($3, role),
           department = COALESCE($4, department),
           is_active = COALESCE($5, is_active),
           updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [full_name, email, role, department, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
};

const deactivate = async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deactivated' });
  } catch (err) { next(err); }
};

module.exports = { list, create, get, stats, update, deactivate };
