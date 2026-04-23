const express = require('express');
const router = express.Router();
const { apiKeyAuth, requirePermission } = require('../middleware/auth');
const reviewController = require('../controllers/reviewController');

router.use(apiKeyAuth);

router.get('/', reviewController.list);
router.get('/:id', reviewController.get);
router.post('/generate', requirePermission('write'), reviewController.generate);

module.exports = router;
