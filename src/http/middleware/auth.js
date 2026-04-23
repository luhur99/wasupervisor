const { query } = require('../../config/database');
const { hashApiKey, timingSafeEqual } = require('../../utils/crypto');
const logger = require('../../utils/logger');

async function apiKeyAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) {
    return res.status(401).json({ error: 'Empty API key' });
  }

  const keyHash = hashApiKey(rawKey);

  try {
    const result = await query(
      `SELECT id, name, permissions, expires_at, is_active
       FROM api_keys
       WHERE key_hash = $1 AND is_active = TRUE`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const apiKey = result.rows[0];

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return res.status(401).json({ error: 'API key expired' });
    }

    await query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [apiKey.id]);

    req.apiKey = apiKey;
    req.permissions = apiKey.permissions || ['read'];
    next();
  } catch (err) {
    logger.error('API key auth error', { error: err.message });
    return res.status(500).json({ error: 'Authentication error' });
  }
}

function requirePermission(permission) {
  return (req, res, next) => {
    const perms = req.permissions || [];
    if (perms.includes(permission) || perms.includes('admin')) {
      return next();
    }
    return res.status(403).json({ error: `Insufficient permissions. Required: ${permission}` });
  };
}

module.exports = { apiKeyAuth, requirePermission };
