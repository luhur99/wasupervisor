const express = require('express');
const router = express.Router();
const { apiKeyAuth, requirePermission } = require('../middleware/auth');
const taskController = require('../controllers/taskController');

router.use(apiKeyAuth);

router.get('/', taskController.list);
router.post('/', requirePermission('write'), taskController.create);
router.get('/:id', taskController.get);
router.patch('/:id', requirePermission('write'), taskController.update);
router.delete('/:id', requirePermission('write'), taskController.remove);
router.post('/:id/remind-now', requirePermission('write'), taskController.remindNow);

module.exports = router;
