require('dotenv').config();
const { createApp } = require('./http/server');
const { checkConnection } = require('./config/database');
const logger = require('./utils/logger');

const PORT = parseInt(process.env.PORT || '3000');

async function main() {
  try {
    await checkConnection();
    logger.info('Database connection established');
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info(`WA Supervisor running on port ${PORT}`, {
      env: process.env.NODE_ENV,
      pid: process.pid,
    });
  });

  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(() => {
      require('./config/database').pool.end();
      logger.info('Server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
