/**
 * Mock für expo-constants
 * 
 * Simuliert Constants für Tests
 */

const Constants = {
  deviceId: 'test-device-id-12345',
  manifest: {},
  expoConfig: {},
  platform: {
    ios: null,
    android: null,
  },
  isDevice: false,
  appOwnership: 'standalone',
};

module.exports = Constants;
module.exports.default = Constants;
