const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { todayWIB } = require('../utils/dateUtils');
const logger = require('../utils/logger');

const BASE_PATH = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads', 'responses');
const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10');

function getDayDir() {
  const today = todayWIB();
  const [year, month, day] = today.split('-');
  const dir = path.join(BASE_PATH, year, month, day);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getPublicUrl(filePath) {
  const relative = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
  return `/${relative}`;
}

async function savePhoto(buffer, taskId, userId) {
  if (buffer.byteLength > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`File too large (max ${MAX_SIZE_MB}MB)`);
  }

  const dir = getDayDir();
  const ts = Date.now();
  const filename = `${taskId.slice(0, 8)}_${userId.slice(0, 8)}_${ts}.jpg`;
  const filePath = path.join(dir, filename);

  await sharp(buffer)
    .jpeg({ quality: 85 })
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .toFile(filePath);

  logger.info('Photo saved', { path: filePath, size: buffer.byteLength });
  return getPublicUrl(filePath);
}

async function savePhotoFromUrl(mediaUrl, taskId, userId) {
  const { downloadMedia } = require('./cloudchatService');
  const { buffer } = await downloadMedia(mediaUrl);
  return savePhoto(buffer, taskId, userId);
}

module.exports = { savePhoto, savePhotoFromUrl, getPublicUrl };
