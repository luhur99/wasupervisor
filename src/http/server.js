const express = require('express');
const { apiLimiter, webhookLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Static uploads directory (photos from PICs)
  const path = require('path');
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Routes
  app.use('/health', require('./routes/health'));

  app.use('/webhook', webhookLimiter, require('./routes/webhook'));

  app.use('/api/v1', apiLimiter);
  app.use('/api/v1/tasks', require('./routes/tasks'));
  app.use('/api/v1/users', require('./routes/users'));
  app.use('/api/v1/responses', require('./routes/responses'));
  app.use('/api/v1/reviews', require('./routes/reviews'));
  app.use('/api/v1/reminders', require('./routes/reminders'));
  app.use('/api/v1/categories', require('./routes/categories'));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
