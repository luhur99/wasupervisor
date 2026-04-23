const crypto = require('crypto');

function hashApiKey(rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

module.exports = { hashApiKey, generateApiKey, timingSafeEqual };
