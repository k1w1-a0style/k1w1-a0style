export const CONFIG = {
  API: {
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
    SUPABASE_EDGE_URL:
      process.env.EXPO_PUBLIC_SUPABASE_EDGE_URL ||
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1` ||
      "",
    GITHUB_API_URL: "https://api.github.com",
  },

  BUILD: {
    DEFAULT_BUILD_PROFILE: "preview",
    DEFAULT_BUILD_TYPE: "normal",
    BUILD_TIMEOUT_MS: 15 * 60 * 1000,
    POLL_INTERVAL_MS: 5000,
    MAX_RETRIES: 3,
    GITHUB_REPO: process.env.EXPO_PUBLIC_GITHUB_REPO || "",
  },

  STORAGE: {
    GITHUB_TOKEN_KEY: "github_token",
    ACTIVE_REPO_KEY: "active_repo",
    BUILD_HISTORY_KEY: "build_history",
    SETTINGS_KEY: "app_settings",
  },

  NOTIFICATIONS: {
    ENABLE_BUILD_NOTIFICATIONS: true,
    ENABLE_ERROR_NOTIFICATIONS: true,
  },

  UI: {
    ANIMATION_DURATION: 300,
    MAX_LOG_LINES: 1000,
    MAX_ERROR_ANALYSES: 10,
  },

  VALIDATION: {
    ALLOWED_BUILD_PROFILES: ["development", "preview", "production"],
    ALLOWED_BUILD_TYPES: ["normal", "debug", "release"],
    MAX_REPO_NAME_LENGTH: 100,

    ALLOWED_ROOT: [
      "app.json",
      "app.config.js",
      "package.json",
      "package-lock.json",
      "yarn.lock",
      "eas.json",
      "tsconfig.json",
      "babel.config.js",
      "metro.config.js",
      "index.js",
      "App.js",
      "App.tsx",
      ".gitignore",
      "README.md",

      "assets/",
      "src/",
      "components/",
      "screens/",
      "navigation/",
      "hooks/",
      "utils/",
      "styles/",
      "lib/",
      "types/",
      "config/",
      "services/",
      "contexts/",

      ".github/workflows/validate-and-test.yml",
      ".github/workflows/eas-build.yml",
      ".github/workflows/web-preview.yml",
      ".github/workflows/release-build.yml",
      ".github/workflows/k1w1-triggered-build.yml",

      "supabase/functions/",
      "supabase/config.toml",
    ],
  },
};
