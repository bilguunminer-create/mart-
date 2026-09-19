import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uskfamilymart.admin',
  appName: 'US&K Admin',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#1c1917',
      showSpinner: false,
    },
  },
};

export default config;
