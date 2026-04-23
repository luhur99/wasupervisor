const express = require('express');
const router = express.Router();
const { apiKeyAuth, requirePermission } = require('../middleware/auth');
const userController = require('../controllers/userController');

router.use(apiKeyAuth);

router.get('/', userController.list);
router.post('/', requirePermission('write'), userController.create);
router.get('/:id', userController.get);
router.get('/:id/stats', userController.stats);
router.patch('/:id', requirePermission('write'), userController.update);
router.delete('/:id', requirePermission('write'), userController.deactivate);

module.exports = router;
