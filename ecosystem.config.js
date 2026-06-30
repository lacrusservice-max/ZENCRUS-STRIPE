const path = require('path')
const os = require('os')

function getLanIp() {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
}

const ROOT = __dirname
const LAN_IP = getLanIp()

module.exports = {
  apps: [
    {
      name: 'zencrus-backend',
      cwd: path.join(ROOT, 'backend'),
      script: 'npm',
      args: 'run dev',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '5s',
      env: {
        NODE_ENV: 'development',
      },
      log_file: '/tmp/zencrus_backend.log',
      error_file: '/tmp/zencrus_backend_err.log',
      merge_logs: true,
    },
    {
      name: 'zencrus-metro',
      cwd: path.join(ROOT, 'frontend'),
      script: 'npx',
      args: 'expo start --lan --clear',
      watch: false,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      env: {
        EXPO_NO_DOCTOR: '1',
      },
      log_file: '/tmp/zencrus_metro.log',
      error_file: '/tmp/zencrus_metro_err.log',
      merge_logs: true,
    },
  ],
}
