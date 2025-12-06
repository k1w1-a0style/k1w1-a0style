// eslint.config.js – Expo Flat Config + Ignore für Supabase Functions (Deno)
// https://docs.expo.dev/guides/using-eslint/

const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  // Expo-Standardkonfiguration
  expoConfig,
  // Projekt-spezifische Overrides
  {
    ignores: [
      'dist/*',
      'supabase/functions/**', // Deno Edge Functions -> werden nicht von Node-ESLint geprüft
    ],
  },
]);
