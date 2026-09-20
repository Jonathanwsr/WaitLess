// Convertido de app.json para app.config.js para poder ler o token secreto do
// Mapbox a partir do .env (mobile/.env fica fora do git) em vez de deixá-lo
// gravado direto num arquivo versionado.
module.exports = {
  expo: {
    name: 'mobile',
    slug: 'mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'mobile',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Precisamos da sua localização para mostrar ao estabelecimento que você está a caminho, em tempo real.',
        NSLocationAlwaysAndWhenInUseUsageDescription:
          'Precisamos da sua localização, mesmo com o app em segundo plano, para o estabelecimento acompanhar sua chegada em tempo real.',
        UIBackgroundModes: ['location'],
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.waitless.app',
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      'expo-secure-store',
      'expo-web-browser',
      '@react-native-community/datetimepicker',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Precisamos da sua localização para mostrar ao estabelecimento que você está a caminho, em tempo real.',
          locationAlwaysAndWhenInUsePermission:
            'Precisamos da sua localização, mesmo com o app em segundo plano, para o estabelecimento acompanhar sua chegada em tempo real.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      [
        '@rnmapbox/maps',
        {
          RNMapboxMapsDownloadToken: process.env.MAPBOX_ACCESS_TOKEN,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: false,
    },
    extra: {
      router: {},
      eas: {
        projectId: '8fba7cba-fd10-4493-9aac-7defbd07b2ad',
      },
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/8fba7cba-fd10-4493-9aac-7defbd07b2ad',
    },
  },
};
