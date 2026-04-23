const axios = require('axios');
const logger = require('../utils/logger');

const client = axios.create({
  baseURL: process.env.CLOUDCHAT_API_URL || 'https://app.cloudchat.id/api/public/v1/messages',
  timeout: 15000,
  headers: {
    'Authorization': `Bearer ${process.env.CLOUDCHAT_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

async function _send(payload) {
  const data = { channel: 'whatsapp', ...payload };
  try {
    const res = await client.post('', data);
    logger.info('CloudChat message sent', { to: payload.to, type: payload.type, msgId: res.data?.message_id });
    return res.data;
  } catch (err) {
    logger.error('CloudChat send failed', {
      to: payload.to,
      type: payload.type,
      status: err.response?.status,
      error: err.response?.data || err.message,
    });
    throw err;
  }
}

async function sendText(to, text) {
  return _send({ to, type: 'text', content: { text } });
}

async function sendButton(to, { title, text, footer, buttons, mediaUrl = null }) {
  const payload = { to, type: 'button', content: { title, text, footer, buttons } };
  if (mediaUrl) payload.media_url = mediaUrl;
  return _send(payload);
}

async function sendMedia(to, mediaUrl, caption = '') {
  return _send({ to, type: 'image', content: { text: caption }, media_url: mediaUrl });
}

async function downloadMedia(mediaUrl) {
  const res = await axios.get(mediaUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    headers: { 'Authorization': `Bearer ${process.env.CLOUDCHAT_API_KEY}` },
  });
  return {
    buffer: Buffer.from(res.data),
    contentType: res.headers['content-type'] || 'image/jpeg',
  };
}

module.exports = { sendText, sendButton, sendMedia, downloadMedia };
