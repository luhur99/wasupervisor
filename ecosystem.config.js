module.exports = {
  apps: [
    {
      name: 'wa-supervisor',
      script: 'src/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      // Workers run as a SINGLE instance — prevents duplicate cron triggers
      name: 'wa-supervisor-workers',
      script: 'src/workers/workerRegistry.js',
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '256M',
      error_file: 'logs/pm2-workers-error.log',
      out_file: 'logs/pm2-workers-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 10000,
      max_restarts: 5,
    },
  ],
};
