function normalizePhone(phone) {
  if (!phone) return null;
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0')) p = '62' + p.slice(1);
  if (!p.startsWith('62')) p = '62' + p;
  return p;
}

function isValidPhone(phone) {
  const p = normalizePhone(phone);
  return p && /^62\d{9,13}$/.test(p);
}

module.exports = { normalizePhone, isValidPhone };
