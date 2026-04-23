const axios = require('axios');

const cloudchatClient = axios.create({
  baseURL: process.env.CLOUDCHAT_API_URL || 'https://app.cloudchat.id/api/public/v1/messages',
  timeout: 10000,
  headers: {
    'Authorization': `Bearer ${process.env.CLOUDCHAT_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

cloudchatClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const logger = require('../utils/logger');
    logger.error('CloudChat API error', {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
    return Promise.reject(err);
  }
);

module.exports = cloudchatClient;
