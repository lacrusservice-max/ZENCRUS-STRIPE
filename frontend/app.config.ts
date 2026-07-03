import { ExpoConfig, ConfigContext } from 'expo/config'

const RAILWAY_URL = 'https://web-production-1d2e22.up.railway.app/api'

const getApiUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL
  return RAILWAY_URL
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'ZENCRUS',
  slug: 'zencrus',
  version: '1.0.0',
  scheme: 'zencrus',
  orientation: 'portrait',
  icon: './src/assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './src/assets/images/icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a0a',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.lacruss.zencrus',
    buildNumber: '1',
    infoPlist: {
      NSCameraUsageDescription: 'Para escanear alimentos y tomar fotos de tus comidas',
      NSPhotoLibraryUsageDescription: 'Para seleccionar fotos de tu galería',
      NSFaceIDUsageDescription: 'Para acceso rápido y seguro a tu cuenta',
      NSLocationWhenInUseUsageDescription: 'Para personalizar recomendaciones según tu ubicación',
    },
    associatedDomains: ['applinks:zencrus.com'],
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './src/assets/images/adaptive-icon.png',
      backgroundColor: '#0a0a0a',
    },
    package: 'com.lacruss.zencrus',
    versionCode: 1,
    permissions: [
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'USE_BIOMETRIC',
      'USE_FINGERPRINT',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'POST_NOTIFICATIONS',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './src/assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-secure-store',
    ['expo-local-authentication', {
      faceIDPermission: 'Permite Face ID para acceso seguro',
    }],
    ['expo-image-picker', {
      photosPermission: 'Accede a tus fotos para personalizar tu perfil',
      cameraPermission: 'Usa la cámara para registrar tus comidas',
    }],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: getApiUrl(),
    stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '',
  },
})
