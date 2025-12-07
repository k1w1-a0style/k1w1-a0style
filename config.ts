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
      INVALID_PATH: /\.\.|\/\.|node_modules|\.git/,
      FORBIDDEN_IMPORT: /require\(['"]fs['"]\)|require\(['"]child_process['"]\)/,
      CONFIG_FILES: /\b(config|\.config\.|babel\.config|metro\.config|app\.config)\b/i,
      CODE_HEURISTIC: /(import|export|function|const|let|var|class|interface|type|=>|\{|\})/,
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
        '/* TODO */',
        '/* TODO:',
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
    FILE_RULES: {
      ALLOW_EMPTY_FILES: [
        '.gitignore',
        '.gitattributes',
        '.editorconfig',
      ],
      // Dateien, die typischerweise kurz sein dürfen
      ALLOW_SHORT_FILES: [
        'App.js',
        'index.js',
        'babel.config.js',
        'metro.config.js',
        'app.config.js',
      ],
    },
  },

  PATHS: {
    PROJECTS_DIR: 'projects',
    EXPORT_DIR: 'exports',
    TEMP_DIR: 'tmp',
    ALLOWED_EXT: ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.yml', '.yaml', '.html', '.css', '.scss', '.svg'],
    ALLOWED_ROOT: ['package.json', 'tsconfig.json', 'babel.config.js', 'metro.config.js', 'app.config.js', 'App.tsx', 'App.js', 'index.js', 'index.html', 'README.md', '.gitignore', '.env.example'],
    ALLOWED_SINGLE: ['theme.ts', 'config.ts'],
    ALLOWED_PREFIXES: ['screens/', 'components/', 'contexts/', 'hooks/', 'lib/', 'utils/', 'assets/', 'navigation/', 'services/', 'api/', 'types/', 'constants/', 'config/', 'store/', 'redux/', 'state/', 'public/'],
  },

  API: {
    // Optional: falls du später eigene Proxy-Endpunkte nutzt
    OPENAI_BASE_URL: 'https://api.openai.com/v1',
    ANTHROPIC_BASE_URL: 'https://api.anthropic.com/v1',
    // Supabase Edge Functions URL - wird dynamisch aus AsyncStorage gelesen
    // Hier als Fallback/Referenz
    SUPABASE_EDGE_URL: '',
  },

  ORCHESTRATOR: {
    // Default Quality Mode
    DEFAULT_QUALITY: 'speed',
    MAX_CONTEXT_FILES: 40,
    MAX_FILE_CHARS: 12000,
  },
} as const;

// 🔒 Kleine Selbstprüfung: sicherstellen, dass Regex valid sind
(() => {
  const patterns = CONFIG.VALIDATION.PATTERNS as Record<string, any>;
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
