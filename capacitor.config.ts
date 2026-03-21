import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAP_SERVER_URL
  ?? (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://whelmproductivity.com");

const config: CapacitorConfig = {
  appId: 'com.whelmproductivity.app',
  appName: 'Whelm',
  webDir: 'www',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
