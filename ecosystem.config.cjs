module.exports = {
  apps: [
    {
      name: 'virtualclassroom',
      script: './scripts/pm2-build-start.sh',
      interpreter: 'bash',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
