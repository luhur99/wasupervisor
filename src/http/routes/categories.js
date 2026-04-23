const express = require('express');
const router = express.Router();
const { apiKeyAuth, requirePermission } = require('../middleware/auth');
const { query } = require('../../config/database');

router.use(apiKeyAuth);

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM task_categories WHERE is_active = TRUE ORDER BY name'
    );
    res.json({ data: result.rows });
  } catch (err) { next(err); }
});

router.post('/', requirePermission('write'), async (req, res, next) => {
  try {
    const { name, description, color_hex, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const result = await query(
      'INSERT INTO task_categories (name, description, color_hex, icon) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, description || null, color_hex || '#3B82F6', icon || 'tasks']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { next(err); }
});

router.patch('/:id', requirePermission('write'), async (req, res, next) => {
  try {
    const { name, description, color_hex, icon, is_active } = req.body;
    const result = await query(
      `UPDATE task_categories
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           color_hex = COALESCE($3, color_hex),
           icon = COALESCE($4, icon),
           is_active = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *`,
      [name, description, color_hex, icon, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
