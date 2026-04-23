const express = require('express');
const router = express.Router();
const { checkConnection } = require('../../config/database');

router.get('/', async (req, res) => {
  const uptime = Math.floor(process.uptime());
  let dbStatus = 'ok';
  try {
    await checkConnection();
  } catch {
    dbStatus = 'error';
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    db: dbStatus,
    uptime,
    version: require('../../../package.json').version,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
