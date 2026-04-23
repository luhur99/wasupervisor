const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

router.post('/cloudchat', webhookController.handle);

module.exports = router;
