// Zentrale Konfiguration für Validierungsregeln, Pfade und Token-Schätzung
export const CONFIG = {
  VALIDATION: {
    // KORREKTUR: Werte reduziert, um minimalen KI-Output zu akzeptieren.
    MIN_LINES_TSX: 10, // Mindestzeilen für .tsx Dateien (war 15, jetzt 10)
    MIN_LINES_TS: 5,   // Mindestzeilen für .ts Dateien (war 10, jetzt 5)

    PATTERNS: {
      // UI-Komponenten
      COMPONENT: /\\b(component|button|card|modal|header|footer|input|list|item)\\b/i,
      // Bildschirme
      SCREEN: /\\b(screen|page|view|home|settings|profile)\\b/i,
      // React Contexts
      CONTEXT: /\\b(context|provider)\\b/i,
      // Custom Hooks
      HOOK: /\\buse[A-Z][A-Za-z0-9_]*\\b/,
      // Utility-Funktionen
      UTIL: /\\b(util|helper|format|validate|constant)\\b/i,
      // API-Services
      SERVICE: /\\b(service|api|client)\\b/i,
      // TypeScript Typen
      TYPE: /\\b(type|interface)\\b/i,
      // Verbotene Duplikat-Muster
      DUPLICATE: /\\b(README[0-9]|App[0-9]|_copy|_backup|\\([0-9]+\\))\\b/i,
      // Ungültige Pfad-Zeichen (Windows + POSIX)
      INVALID_PATH: /\\.\\.\\/|[\\\\:*?"<>|]|^[\\/\\\\]|[\\/\\\\]$/,
      // Konfigurationsdateien
      CONFIG_FILES: /\\b(types|theme|constants|config)\\.ts$|\\.d\\.ts$/
    },
    CONTENT_PATTERNS: {
      CONTEXT: /React\\.createContext|Provider/,
      HOOK: /useState|useEffect|useRef|useCallback/,
      STYLE: /StyleSheet\\.create/,
      PLACEHOLDERS: [
        '// ... existing code',
        '// ... rest of',
        '// ... other',
        '/* ... */',
        '// TODO: implement',
        '// Previous code',
        '// Add your code',
        '// Insert code here',
        '() => {}'
      ]
    }
  },
  PATHS: {
    ALLOWED_ROOT: [
      'App.tsx',
      'theme.ts',
      'package.json',
      'app.config.js',
      'README.md',
      'expo-env.d.ts',
      '.gitignore',
      'tsconfig.json',
      'babel.config.js',
      'metro.config.js'
    ] as const,
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
      'assets'
    ] as const,
    MAX_PATH_LENGTH: 255
  },
  TOKEN_RATIO: {
    groq: 4,
    openai: 3.8,
    anthropic: 4.2,
    gemini: 4,
    default: 4
  } as const
} as const;

// Regex-Validierung zur Kompilierzeit (robust gegenüber RegExp oder String)
(function validateRegex() {
  const patterns = (CONFIG.VALIDATION.PATTERNS as Record<string, RegExp | string>);
  Object.entries(patterns).forEach(([key, pattern]) => {
    try {
      if (pattern instanceof RegExp) {
        // ok
      } else if (typeof pattern === 'string') {
        new RegExp(pattern);
      } else {
        // fallback
        new RegExp(String(pattern));
      }
    } catch (e) {
      throw new Error(`Ungültiges Regex in CONFIG.VALIDATION.PATTERNS.${key}: ${e}`);
    }
  });
})();
