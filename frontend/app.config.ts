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

      /* Los textos de ubicación y movimiento NO se ponen aquí: los escribe el
         plugin de expo-location más abajo, y el plugin gana. Tenerlos en los
         dos sitios daba dos versiones distintas del mismo aviso y la que se
         veía en pantalla era siempre la otra.
         La de abajo sí, porque ningún plugin la toca. */
      NSLocationAlwaysUsageDescription:
        'Para seguir midiendo tu carrera con la pantalla bloqueada.',

      /* Sin esto el sistema congela la app al bloquear la pantalla y la carrera
         se queda a medias — es la diferencia entre un cronómetro y un GPS. */
      UIBackgroundModes: ['location'],
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

      /* Running. ACCESS_BACKGROUND_LOCATION se pide APARTE y en su propia
         pantalla —Android obliga a que el usuario elija «Permitir siempre» a
         mano—, así que pedirlo a la vez que el resto no funciona. */
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      /* Desde Android 14 un servicio en primer plano tiene que declarar de qué
         tipo es; sin el par FOREGROUND_SERVICE_LOCATION el sistema mata el
         servicio en cuanto arranca. */
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      /* Podómetro. */
      'ACTIVITY_RECOGNITION',
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
    /* Los sonidos de alarma se EMPAQUETAN en el binario: iOS solo puede sonar
       con ficheros que vengan dentro de la app, porque no presta los tonos del
       sistema a nadie más que a su Reloj.

       Para añadir uno: déjalo en `src/assets/sounds/`, añádelo a esta lista y
       añade su entrada en `src/constants/sonidosAlarma.ts`. Después hay que
       RECOMPILAR el dev client — Fast Refresh no mete ficheros en el binario.

       Formato: .wav, .aiff o .caf, PCM o IMA4, y menos de 30 segundos. iOS
       ignora el que se pase y pone el de por defecto en su lugar. */
    ['expo-notifications', {
      sounds: [] as string[],
    }],
    'expo-secure-store',
    ['expo-local-authentication', {
      faceIDPermission: 'Permite Face ID para acceso seguro',
    }],
    ['expo-image-picker', {
      photosPermission: 'Accede a tus fotos para personalizar tu perfil',
      cameraPermission: 'Usa la cámara para registrar tus comidas',
    }],

    /* El escáner de códigos de barras. `expo-camera` llevaba instalado desde
       hacía tiempo sin que lo importara ningún fichero, así que su plugin
       tampoco estaba declarado: en Expo Go daba igual —el cliente ya trae la
       cámara compilada dentro— pero en un dev client o en una build de EAS
       faltaría el permiso en el Info.plist y `CameraView` se quedaría en negro.

       `microphonePermission: false` porque aquí no se graba vídeo: pedir el
       micrófono para leer un código de barras es pedir de más. */
    ['expo-camera', {
      cameraPermission: 'Lee el código de barras de los envases para apuntar el alimento. No se guarda ninguna imagen.',
      microphonePermission: false,
      recordAudioAndroid: false,
    }],

    /* Guardar en el carrete las fotos del chat. `savePhotosPermission` es un
       permiso DISTINTO al de leer: iOS los pregunta por separado, y sin este
       la llamada a guardar falla aunque ya se tenga acceso a las fotos.
       `isAccessMediaLocationEnabled` se queda apagado: la localización que
       lleva dentro una foto no hace falta para nada aquí. */
    ['expo-media-library', {
      photosPermission: 'Accede a tus fotos para personalizar tu perfil',
      savePhotosPermission: 'Guarda en tu carrete las fotos que recibas en los chats de la comunidad',
      isAccessMediaLocationEnabled: false,
    }],

    /* Running. Las dos banderas de Android son las que hacen que la carrera
       sobreviva a la pantalla bloqueada: sin ellas el prebuild no declara el
       servicio en primer plano y el sistema corta la grabación. */
    /* Estos textos son lo ÚNICO que iOS enseña al pedir el permiso, y solo lo
       pregunta una vez: si el usuario dice que no porque el aviso no explicaba
       nada, recuperarlo exige que se vaya a Ajustes a mano. Por eso cada uno
       dice qué se hace con el dato en vez de una generalidad. */
    ['expo-location', {
      locationAlwaysAndWhenInUsePermission:
        'Para seguir midiendo tu carrera cuando bloqueas la pantalla o guardas el teléfono en el bolsillo. Sin esto, la grabación se corta al salir de la app.',
      locationWhenInUsePermission:
        'Para medir la distancia, el ritmo y el recorrido de tus carreras mientras la app está abierta.',
      isAndroidBackgroundLocationEnabled: true,
      isAndroidForegroundServiceEnabled: true,
    }],
    ['expo-sensors', {
      motionPermission:
        'Para contar tus pasos y tu cadencia con el sensor de movimiento del iPhone. ZENCRUS no accede a la app Salud de Apple.',
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
