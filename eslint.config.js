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

      // Logging policy: new console usage should be visible in lint output.
      // CI uses --quiet, therefore warnings stay non-blocking until we decide
      // to tighten this rule further.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

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


      // Architecture boundaries (prevent cross-layer dependency drift)
      // - shared/* must not import from contexts/* or screens/* or components/* (UI / state layer)
      // - shared/types/* should stay pure (no lib/* runtime deps)
      'import/no-restricted-paths': ['error', {
        zones: [
          { target: './shared', from: './contexts', message: 'shared/* must not import from contexts/* (layering boundary).' },
          { target: './shared', from: './screens', message: 'shared/* must not import from screens/* (layering boundary).' },
          { target: './shared', from: './components', message: 'shared/* must not import from components/* (layering boundary).' },
          { target: './shared/types', from: './lib', message: 'shared/types/* must not import from lib/* (keep shared types pure).' },
          { target: './shared/types', from: './infra', message: 'shared/types/* must not import from infra/* (keep shared types pure).' },
        ],
      }],

    },
  },
];
