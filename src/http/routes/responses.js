const express = require('express');
const router = express.Router();
const { apiKeyAuth } = require('../middleware/auth');
const responseController = require('../controllers/responseController');

router.use(apiKeyAuth);

router.get('/', responseController.list);
router.get('/:id', responseController.get);

module.exports = router;
