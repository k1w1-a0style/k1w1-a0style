// Zentrale Konfiguration für Validierung, Pfade, API-Endpunkte usw.
export const CONFIG = {
  VALIDATION: {
    MIN_LINES_TSX: 8,
    MIN_LINES_TS: 5,
    MAX_FILES: 200,
    PATTERNS: {
      COMPONENT: /\b(component|button|card|modal|header|footer|input|list|item)\b/i,
      SCREEN: /\b(screen|page|view|home|settings|profile)\b/i,
      CONTEXT: /\b(context|provider)\b/i,
      HOOK: /\buse[A-Z][A-Za-z0-9_]*\b/,
      UTIL: /\b(util|helper|format|validate|constant)\b/i,
      SERVICE: /\b(service|api|client)\b/i,
      TYPE: /\b(type|interface)\b/i,
      DUPLICATE: /\b(README[0-9]|App[0-9]|_copy|_backup|\([0-9]+\))\b/i,
      INVALID_PATH: /\.\.\/|[\\:*?"<>|]|^[\/\\]|[\/\\]$/,
      CONFIG_FILES: /\b(types|theme|constants|config)\.ts$|\.d\.ts$/,
      FORBIDDEN_IMPORT: /\bfrom\s+['"]react-native-web['"]/i,
      CODE_HEURISTIC: /(import|export|function|const|let|=>|React\.|StyleSheet\.create)/i,
    },
    CONTENT_PATTERNS: {
      CONTEXT: /React\.createContext|Provider/,
      HOOK: /useState|useEffect|useRef|useCallback/,
      STYLE: /StyleSheet\.create/,
      PLACEHOLDERS: [
        '// ... existing code',
        '// ... rest of file',
        '// TODO',
        '// TODO:',
        '// implement',
        '/* TODO */',
        'return null;',
        '() => {}',
      ],
    },
  },

  PATHS: {
    // Root-Dateien, die erlaubt sind (nur im Projekt-Root)
    ALLOWED_ROOT: [
      'App.tsx',
      'App.js',
      'index.js',

      'config.ts',
      'theme.ts',

      'README.md',
      'SYSTEM_README.md',

      'package.json',
      'tsconfig.json',

      'app.config.js',
      'babel.config.js',
      'metro.config.js',
      'eas.json',

      'eslint.config.js',
      'jest.config.js',
      'jest.setup.js',

      'expo-env.d.ts',
      '.gitignore',

      '.github/workflows/ci-build.yml',
      '.github/workflows/k1w1-triggered-build.yml',
      '.github/workflows/release-build.yml',
      '.github/workflows/eas-build.yml',
    ] as string[],

    // Ordner, die als “Source Folders” gelten
    SRC_FOLDERS: [
      'components',
      'screens',
      'contexts',
      'hooks',
      'utils',
      'services',
      'types',
      'styles',
      'assets',
      'navigation',

      // ✅ im Dump vorhanden → muss erlaubt sein
      'lib',
      'scripts',
      'templates',
      'supabase',
      '__tests__',
      '__mocks__',
    ] as string[],

    // Erlaubte Präfixe (alles darunter darf existieren/geschrieben werden)
    ALLOWED_PREFIXES: [
      'components/',
      'screens/',
      'contexts/',
      'hooks/',
      'utils/',
      'services/',
      'types/',
      'styles/',
      'assets/',
      'navigation/',

      // ✅ im Dump vorhanden → muss erlaubt sein
      'lib/',
      'scripts/',
      'templates/',
      'supabase/',
      '__tests__/',
      '__mocks__/',
      '.github/',
    ] as string[],

    ALLOWED_SINGLE: [
      'app.config.js',
      'package.json',
      'tsconfig.json',
      'babel.config.js',
      'metro.config.js',
      'eslint.config.js',
      'jest.config.js',
      'jest.setup.js',
      'theme.ts',
      'config.ts',
      'README.md',
      'SYSTEM_README.md',
      'index.js',
      'App.tsx',
      'App.js',
      'eas.json',
      'expo-env.d.ts',
      '.gitignore',
    ] as string[],

    ALLOWED_EXT: [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.json',
      '.md',
      '.svg',
      '.png',
      '.jpg',
      '.yml',
      '.gitignore',
    ] as string[],

    MAX_PATH_LENGTH: 255,
  },

  API: {
    SUPABASE_EDGE_URL:
      (process.env.EXPO_PUBLIC_SUPABASE_EDGE_URL as string | undefined) ||
      'https://xfgnzpcljsuqqdjlxgul.supabase.co/functions/v1',
  },

  BUILD: {
    GITHUB_REPO: 'k1w1-pro-plus/k1w1-a0style',
  },

  TOKEN_RATIO: {
    groq: 4,
    openai: 3.8,
    anthropic: 4.2,
    gemini: 4,
    default: 4,
  } as const,
} as const;
