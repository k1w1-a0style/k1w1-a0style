// Inhalt für app.config.js:
/**
 * app.config.js – Expo App Config
 * ✅ android.softwareKeyboardLayoutMode = "pan"
 * ✅ EAS projectId nur wenn ENV gesetzt ist (kein Dummy!)
 */

require('dotenv').config();

const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

module.exports = {
  expo: {
    jsEngine: 'hermes',
    name: 'k1w1-a0style',
    slug: 'k1w1-a0style',
    version: '1.0.0',
    scheme: 'k1w1a0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',

    // ✅ Expo wollte das (wegen expo-font install/dev-client)
    plugins: ['expo-font'],

    assetBundlePatterns: ['**/*'],

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.k1w1.a0style',
    },

    android: {
      package: 'com.k1w1.a0style',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      softwareKeyboardLayoutMode: 'pan',
    },

    web: {
      bundler: 'metro',
      output: 'single',
    },

    extra: {
      eas: {
        ...(EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : {}),
      },
    },
  },
};
