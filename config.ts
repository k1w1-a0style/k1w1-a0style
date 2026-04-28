// Zentrale Konfiguration für Validierung, Pfade, API-Endpunkte usw.
import Constants from "expo-constants";

type ExpoConfigExtra = Record<string, unknown>;
type RuntimeEnvKey =
  | "EXPO_PUBLIC_K1W1_MAX_FILES"
  | "K1W1_MAX_FILES"
  | "EXPO_PUBLIC_K1W1_PROMPT_MAX_SNAPSHOT_FILES"
  | "K1W1_PROMPT_MAX_SNAPSHOT_FILES"
  | "EXPO_PUBLIC_K1W1_PROMPT_MAX_LINES_PER_FILE"
  | "K1W1_PROMPT_MAX_LINES_PER_FILE"
  | "EXPO_PUBLIC_SUPABASE_EDGE_URL"
  | "EXPO_PUBLIC_SUPABASE_URL";

function readExpoExtra(): ExpoConfigExtra {
  const expoConfig = (Constants as { expoConfig?: { extra?: ExpoConfigExtra } | null }).expoConfig;
  return expoConfig?.extra && typeof expoConfig.extra === "object" ? expoConfig.extra : {};
}

function readKnownProcessEnv(key: RuntimeEnvKey): string | undefined {
  switch (key) {
    case "EXPO_PUBLIC_K1W1_MAX_FILES":
      return process.env.EXPO_PUBLIC_K1W1_MAX_FILES;
    case "K1W1_MAX_FILES":
      return process.env.K1W1_MAX_FILES;
    case "EXPO_PUBLIC_K1W1_PROMPT_MAX_SNAPSHOT_FILES":
      return process.env.EXPO_PUBLIC_K1W1_PROMPT_MAX_SNAPSHOT_FILES;
    case "K1W1_PROMPT_MAX_SNAPSHOT_FILES":
      return process.env.K1W1_PROMPT_MAX_SNAPSHOT_FILES;
    case "EXPO_PUBLIC_K1W1_PROMPT_MAX_LINES_PER_FILE":
      return process.env.EXPO_PUBLIC_K1W1_PROMPT_MAX_LINES_PER_FILE;
    case "K1W1_PROMPT_MAX_LINES_PER_FILE":
      return process.env.K1W1_PROMPT_MAX_LINES_PER_FILE;
    case "EXPO_PUBLIC_SUPABASE_EDGE_URL":
      return process.env.EXPO_PUBLIC_SUPABASE_EDGE_URL;
    case "EXPO_PUBLIC_SUPABASE_URL":
      return process.env.EXPO_PUBLIC_SUPABASE_URL;
  }
}

function readRuntimeConfigString(envKeys: RuntimeEnvKey[], extraKeys: string[]): string | undefined {
  const extra = readExpoExtra();

  for (const key of extraKeys) {
    const value = extra[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  if (typeof process !== "undefined" && process?.env) {
    for (const key of envKeys) {
      const value = readKnownProcessEnv(key);
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }

  return undefined;
}

function readRuntimeConfigNumber(params: {
  envKeys: RuntimeEnvKey[];
  extraKeys: string[];
  fallback: number;
  min?: number;
}): number {
  const raw = readRuntimeConfigString(params.envKeys, params.extraKeys);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return params.fallback;
  if (typeof params.min === "number" && parsed < params.min) return params.fallback;
  return parsed;
}

const runtimeMaxFiles = readRuntimeConfigNumber({
  envKeys: ["EXPO_PUBLIC_K1W1_MAX_FILES", "K1W1_MAX_FILES"],
  extraKeys: ["k1w1MaxFiles", "maxFiles"],
  fallback: 200,
  min: 1,
});

const runtimePromptMaxSnapshotFiles = readRuntimeConfigNumber({
  envKeys: ["EXPO_PUBLIC_K1W1_PROMPT_MAX_SNAPSHOT_FILES", "K1W1_PROMPT_MAX_SNAPSHOT_FILES"],
  extraKeys: ["k1w1PromptMaxSnapshotFiles", "promptMaxSnapshotFiles"],
  fallback: 28,
  min: 1,
});

const runtimePromptMaxLinesPerFile = readRuntimeConfigNumber({
  envKeys: ["EXPO_PUBLIC_K1W1_PROMPT_MAX_LINES_PER_FILE", "K1W1_PROMPT_MAX_LINES_PER_FILE"],
  extraKeys: ["k1w1PromptMaxLinesPerFile", "promptMaxLinesPerFile"],
  fallback: 40,
  min: 1,
});

const runtimeSupabaseEdgeUrl = readRuntimeConfigString(
  ["EXPO_PUBLIC_SUPABASE_EDGE_URL"],
  ["supabaseEdgeUrl"],
);
const runtimeSupabaseUrl = readRuntimeConfigString(
  ["EXPO_PUBLIC_SUPABASE_URL"],
  ["supabaseUrl"],
);

export const CONFIG = {
  VALIDATION: {
    MIN_LINES_TSX: 8,
    MIN_LINES_TS: 5,
    MAX_FILES: runtimeMaxFiles,
    MAX_FILE_SIZE_MB: 10,
    PATTERNS: {
      COMPONENT:
        /\b(component|button|card|modal|header|footer|input|list|item)\b/i,
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
      CODE_HEURISTIC:
        /(import|export|function|const|let|=>|React\.|StyleSheet\.create)/i,
    },
    CONTENT_PATTERNS: {
      CONTEXT: /React\.createContext|Provider/,
      HOOK: /useState|useEffect|useRef|useCallback/,
      STYLE: /StyleSheet\.create/,
      PLACEHOLDERS: [
        "// ... existing code",
        "// ... rest of file",
        "// TODO",
        "// TODO:",
        "// implement",
        "/* TODO */",
        "return null;",
        "() => {}",
      ],
    },
  },

  PATHS: {
    // Root-Dateien, die erlaubt sind (nur im Projekt-Root)
    ALLOWED_ROOT: [
      "App.tsx",
      "App.js",
      "index.js",

      // Common app root helpers
      "api.ts",
      "api.js",
      "constants.ts",
      "constants.js",
      "data.ts",
      "data.js",
      "database.ts",
      "database.js",
      "firebase.ts",
      "firebase.js",
      "supabase.ts",
      "supabase.js",
      "types.ts",
      "interfaces.ts",
      "env.d.ts",
      "global.d.ts",
      "nativewind-env.d.ts",

      // Expo config
      "app.json",
      "app.config.js",

      "config.ts",
      "theme.ts",

      // optional runtime helpers
      "polyfills.ts",

      "README.md",
      "SYSTEM_README.md",
      "TEMPLATE_CHECKLIST_REPORT.md",

      "package.json",
      "package-lock.json",
      "tsconfig.json",

      "babel.config.js",
      "metro.config.js",
      "eas.json",
      "eas-project.json",

      // EAS upload hygiene
      ".easignore",

      // Common project tooling / template root configs
      ".env.example",
      ".env.sample",
      ".env.template",
      ".eslintrc.js",
      ".eslintrc.cjs",
      ".eslintrc.json",
      ".prettierrc",
      ".prettierrc.js",
      ".prettierrc.cjs",
      ".prettierrc.json",
      ".prettierignore",

      "eslint.config.js",
      "jest.config.js",
      "jest.setup.js",
      "prettier.config.js",
      "prettier.config.cjs",
      "tailwind.config.js",
      "tailwind.config.ts",
      "postcss.config.js",
      "commitlint.config.js",
      "vitest.config.ts",

      "expo-env.d.ts",
      ".gitignore",
      ".npmrc",

      ".github/workflows/ci-build.yml",
      ".github/workflows/k1w1-triggered-build.yml",
      ".github/workflows/release-build.yml",
      ".github/workflows/eas-build.yml",
      ".github/workflows/eas-link.yml",
      ".github/workflows/deploy-supabase-functions.yml",
    ] as string[],

    // Ordner, die als “Source Folders” gelten
    SRC_FOLDERS: [
      "src",
      "components",
      "screens",
      "contexts",
      "hooks",
      "utils",
      "services",
      "types",
      "styles",
      "assets",
      "navigation",

      // ✅ im Dump vorhanden → muss erlaubt sein
      "lib",
      "scripts",
      "templates",
      "supabase",
      "__tests__",
      "__mocks__",
    ] as string[],

    // Erlaubte Präfixe (alles darunter darf existieren/geschrieben werden)
    ALLOWED_PREFIXES: [
      "src/",
      "components/",
      "screens/",
      "contexts/",
      "hooks/",
      "utils/",
      "services/",
      "types/",
      "styles/",
      "assets/",
      "navigation/",

      // ✅ im Dump vorhanden → muss erlaubt sein
      "lib/",
      "scripts/",
      "templates/",
      "supabase/",
      "__tests__/",
      "__mocks__/",
      ".github/",
    ] as string[],

    ALLOWED_SINGLE: [
      "app.json",
      "app.config.js",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "babel.config.js",
      "metro.config.js",
      "eslint.config.js",
      "jest.config.js",
      "jest.setup.js",
      "prettier.config.js",
      "prettier.config.cjs",
      "tailwind.config.js",
      "tailwind.config.ts",
      "postcss.config.js",
      "commitlint.config.js",
      "vitest.config.ts",
      "theme.ts",
      "config.ts",
      "api.ts",
      "api.js",
      "constants.ts",
      "constants.js",
      "data.ts",
      "data.js",
      "database.ts",
      "database.js",
      "firebase.ts",
      "firebase.js",
      "supabase.ts",
      "supabase.js",
      "types.ts",
      "interfaces.ts",
      "env.d.ts",
      "global.d.ts",
      "nativewind-env.d.ts",
      "README.md",
      "SYSTEM_README.md",
      "TEMPLATE_CHECKLIST_REPORT.md",
      "index.js",
      "App.tsx",
      "App.js",
      "eas.json",
      "eas-project.json",
      "expo-env.d.ts",
      ".gitignore",
      ".easignore",
      ".npmrc",
      ".env.example",
      ".env.sample",
      ".env.template",
      ".eslintrc.js",
      ".eslintrc.cjs",
      ".eslintrc.json",
      ".prettierrc",
      ".prettierrc.js",
      ".prettierrc.cjs",
      ".prettierrc.json",
      ".prettierignore",
    ] as string[],

    ALLOWED_EXT: [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".cjs",
      ".mjs",
      ".json",
      ".md",
      ".svg",
      ".png",
      ".jpg",
      ".jpeg",
      ".webp",
      ".yml",
      ".yaml",
      ".gitignore",
      ".easignore",
      ".npmrc",
      ".env.example",
      ".env.sample",
      ".env.template",
      ".prettierrc",
      ".prettierignore",
    ] as string[],

    MAX_PATH_LENGTH: 255,
  },

  API: {
    // Prefer explicit edge URL. If only SUPABASE_URL is set, derive /functions/v1.
    SUPABASE_EDGE_URL: runtimeSupabaseEdgeUrl
      ? runtimeSupabaseEdgeUrl
      : runtimeSupabaseUrl
        ? `${runtimeSupabaseUrl.replace(/\/+$/, "")}/functions/v1`
        : "",
  },

  BUILD: {
    GITHUB_REPO: "",
  },

  PROMPT: {
    MAX_SNAPSHOT_FILES: runtimePromptMaxSnapshotFiles,
    MAX_LINES_PER_FILE: runtimePromptMaxLinesPerFile,
  },

  TOKEN_RATIO: {
    groq: 4,
    openai: 3.8,
    anthropic: 4.2,
    gemini: 4,
    default: 4,
  } as const,
} as const;
