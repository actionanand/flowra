import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.actionanand.flowra.app',
  appName: 'Flowra',
  webDir: 'dist/flowra/browser',
  server: { androidScheme: 'https' },
  android: { backgroundColor: '#fff7fb' },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_flowra',
      iconColor: '#d94678',
    },
    SplashScreen: {
      launchShowDuration: 1800,
      backgroundColor: '#fff7fb',
      showSpinner: false,
    },
  },
};

export default config;
