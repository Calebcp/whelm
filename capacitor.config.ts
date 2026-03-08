import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whelmproductivity.app',
  appName: 'Whelm',
  webDir: 'www',
  server: {
    url: 'https://whelmproductivity.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
