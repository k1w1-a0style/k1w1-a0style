// eslint.config.js – Expo Flat Config + Ignore für Supabase Functions (Deno)
// https://docs.expo.dev/guides/using-eslint/

const expoConfig = require('eslint-config-expo/flat');

// Expo Config kann ein Array sein, daher spreaden
const baseConfig = Array.isArray(expoConfig) ? expoConfig : [expoConfig];

module.exports = [
  // Expo-Standardkonfiguration
  ...baseConfig,
  // Projekt-spezifische Overrides
  {
    ignores: [
      'dist/*',
      'supabase/functions/**', // Deno Edge Functions -> werden nicht von Node-ESLint geprüft
    ],
  },
];
