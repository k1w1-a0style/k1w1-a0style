// Zentrale Konfiguration für Validierung, Pfade, API-Endpunkte usw.
export const CONFIG = {
  VALIDATION: {
    // 🔧 Strengere Mindestzeilen für echte Dateien (keine 1-Zeilen-Platzhalter)
    MIN_LINES_TSX: 8,
    MIN_LINES_TS: 5,
    MAX_FILES: 80,
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
        '// ToDo',
        '// ToDo:',
        '// implement',
        '// implement me',
        '// your code here',
        '// Your code here',
        '// add logic',
        '// add implementation',
        '/* TODO */',
        '/* ToDo */',
        '/* implement */',
        '/* your code here */',
        '/* add logic */',
        '/* add implementation */',
        '// placeholder',
        '// placeholder component',
        '// dummy',
        '// dummy component',
        'return null;',
        'throw new Error("NotImplemented");',
        'throw new Error("Not implemented");',
        'throw new Error("TODO");',
        'console.log("TODO");',
        'console.log("NotImplemented");',
        'console.log("Not implemented");',
        '// Previous code',
        '// Add your code',
        '// Insert code here',
        '() => {}',
      ],
    },
  },

  PATHS: {
    ALLOWED_ROOT: [
      'App.tsx',
      'App.js',
      'index.js',
      'theme.ts',
      'config.ts',
      'package.json',
      'app.config.js',
      'README.md',
      'expo-env.d.ts',
      '.gitignore',
      'tsconfig.json',
      'babel.config.js',
      'metro.config.js',
      'eas.json',
      // ✅ CI/Workflow-Dateien explizit erlauben
      '.github/workflows/deploy-supabase-functions.yml',
      '.github/workflows/eas-build.yml',
    ] as string[],

    SRC_FOLDERS: [
      'components',
      'screens',
      'contexts',
      'hooks',
      'utils',
      'services',
      'types',
      'navigation',
      'styles',
      'assets',
    ] as string[],

    ALLOWED_PREFIXES: [
      'components/',
      'screens/',
      'contexts/',
      'hooks/',
      'utils/',
      'services/',
      'types/',
      'navigation/',
      'styles/',
      'assets/',
    ] as string[],

    ALLOWED_SINGLE: [
      'app.config.js',
      'package.json',
      'tsconfig.json',
      'babel.config.js',
      'metro.config.js',
      'theme.ts',
      'App.tsx',
      'App.js',
      'index.js',
      'config.ts',
      'eas.json',
      'README.md',
      'expo-env.d.ts',
      '.gitignore',
      '.github/workflows/deploy-supabase-functions.yml',
      '.github/workflows/eas-build.yml',
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

  // 🔌 Supabase Edge-Funktionen (EAS Build / Check)
  API: {
    SUPABASE_EDGE_URL:
      // optional über env überschreibbar
      (process.env.EXPO_PUBLIC_SUPABASE_EDGE_URL as string | undefined) ||
      'https://xfgnzpcljsuqqdjlxgul.supabase.co/functions/v1',
  },

  // 🔧 Build-spezifische Defaults (GitHub Repo für EAS-Trigger)
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

// Mini-Check der Regex-Patterns zur Build-Zeit
(function validateRegex() {
  const patterns = CONFIG.VALIDATION.PATTERNS as Record<string, RegExp | string>;
  Object.entries(patterns).forEach(([key, pattern]) => {
    try {
      if (pattern instanceof RegExp) return;
      if (typeof pattern === 'string') {
        new RegExp(pattern);
      } else {
        new RegExp(String(pattern));
      }
    } catch (e) {
      throw new Error(
        `Ungültiges Regex in CONFIG.VALIDATION.PATTERNS.${key}: ${String(e)}`
      );
    }
  });
})();
