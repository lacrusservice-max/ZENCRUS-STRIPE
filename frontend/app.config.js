const os = require('os')

function getLanIp() {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}

const LAN_IP = getLanIp()

// URL de producción en Railway — siempre disponible desde cualquier red
const RAILWAY_URL = 'https://zencrus-backend-production.up.railway.app/api'

/** @type {import('@expo/config').ConfigContext} */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    // Si hay API_URL en env usa esa, si no usa Railway (producción), si no usa LAN local (desarrollo)
    apiUrl: process.env.API_URL || RAILWAY_URL,
    devApiUrl: `http://${LAN_IP}:5000/api`,
  },
})
