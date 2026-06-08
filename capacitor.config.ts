import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thtcenter.app',
  appName: 'THT Center',
  webDir: 'out',
  server: {
    androidScheme: 'https'
  }
};

export default config;
