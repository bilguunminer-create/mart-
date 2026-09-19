import type { CapacitorConfig } from '@capacitor/cli';

// Separate native shell identity for the warehouse application.
// Its remote URL means catalog and workflow updates appear without publishing a new APK.
const config: CapacitorConfig = {
  appId: 'mn.uskmart.inventory',
  appName: 'US&K Агуулах',
  webDir: 'dist',
  server: {
    url: 'https://www.uskmart.com/?admin=inventory',
    cleartext: false,
    androidScheme: 'https',
  },
  plugins: {
    Camera: {
      permissions: ['camera'],
    },
  },
};

export default config;