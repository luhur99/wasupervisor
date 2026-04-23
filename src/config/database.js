const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'wa_supervisor',
  user: process.env.DB_USER || 'wa_supervisor_user',
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_POOL_MAX || '10'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  require('./logger') && require('../utils/logger').error('PostgreSQL pool error', { error: err.message });
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    const logger = require('../utils/logger');
    logger.warn('Slow query detected', { duration, query: text.substring(0, 100) });
  }
  return res;
}

async function checkConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, checkConnection };
