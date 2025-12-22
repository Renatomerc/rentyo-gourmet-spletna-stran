module.exports = {
  apps: [{
    name: 'rentyo-gourmet',
    cwd: '/home/sites/rentyo.eu/public_html',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env',
    exp_backoff_restart_delay: 100
  }]
};