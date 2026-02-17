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


  // Node-Skripte (CI) sollen Node-Globals kennen (flat config => kein eslint-env Kommentar)
  {
    files: ['scripts/ci/**/*.js', 'scripts/ci/**/*.cjs'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        process: 'readonly',
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
      },
    },
  },

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

      // Refactor guardrails (strict; fail CI when a facade import slips in)
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'lib/templateChecklist', message: 'Import from lib/diagnostics/templates instead (templateChecklist is facade).' },
          { name: './lib/templateChecklist', message: 'Import from lib/diagnostics/templates instead (templateChecklist is facade).' },
          { name: '../lib/templateChecklist', message: 'Import from lib/diagnostics/templates instead (templateChecklist is facade).' },
          { name: '../../lib/templateChecklist', message: 'Import from lib/diagnostics/templates instead (templateChecklist is facade).' },

          { name: 'contexts/githubService', message: 'Prefer infra/github/* (contexts/githubService is facade).' },
          { name: './contexts/githubService', message: 'Prefer infra/github/* (contexts/githubService is facade).' },
          { name: '../contexts/githubService', message: 'Prefer infra/github/* (contexts/githubService is facade).' },
          { name: '../../contexts/githubService', message: 'Prefer infra/github/* (contexts/githubService is facade).' },

          { name: 'contexts/projectStorage', message: 'Prefer infra/storage/projectPersistence (contexts/projectStorage is facade).' },
          { name: './contexts/projectStorage', message: 'Prefer infra/storage/projectPersistence (contexts/projectStorage is facade).' },
          { name: '../contexts/projectStorage', message: 'Prefer infra/storage/projectPersistence (contexts/projectStorage is facade).' },
          { name: '../../contexts/projectStorage', message: 'Prefer infra/storage/projectPersistence (contexts/projectStorage is facade).' },
        ],
        patterns: [
          { group: ['**/templateChecklist'], message: 'Prefer importing from lib/diagnostics/templates/* for new code.' },
          { group: ['**/contexts/githubService'], message: 'Prefer infra/github/* for new code.' },
          { group: ['**/contexts/projectStorage'], message: 'Prefer infra/storage/projectPersistence for new code.' },
        ],
      }],
    },
  },
];
