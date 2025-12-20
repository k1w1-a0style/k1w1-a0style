// eslint.config.js (Flat Config)
// Expo flat config + GLOBAL ignores + Projekt-spezifische Rules

// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  // ✅ WICHTIG: Global ignores müssen VOR expoConfig kommen,
  // sonst greifen Expo-Regeln bereits auf die Dateien.
  {
    ignores: [
      'node_modules/**',
      'backups/**',
      '.expo/**',
      '.expo-shared/**',
      'dist/**',
      'build/**',
      '__mocks__/**',
      '**/*.test.*',
      'jest.setup.js',
      'supabase/functions/**',
      'web-build/**',
      'android/**',
      'ios/**',
    ],
  },

  ...expoConfig,

  // Projekt-spezifische Lockerungen
  {
    rules: {
      // Import-Kram entspannen
      'import/no-unresolved': 'off',
      'import/no-duplicates': 'off',
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',

      // TS-Style-Regeln, die aktuell nur nerven
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',

      // Hooks-Warnungen abschalten (Code läuft ja)
      'react-hooks/exhaustive-deps': 'off',
    },
  },
];
