import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.intelligen.app',
  appName: 'intelliGen',
  webDir: 'out',
  server: {
    url: 'https://intelligenapp.com',
    cleartext: true
  }
};

export default config;