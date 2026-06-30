const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const config = getDefaultConfig(projectRoot)

// Fix for paths with spaces in expo-router web SSR
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Decode URL-encoded spaces in paths
      if (req.url) {
        req.url = decodeURIComponent(req.url)
      }
      return middleware(req, res, next)
    }
  },
}

module.exports = config
