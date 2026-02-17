// lib/diagnostics/templates/requiredFiles.ts

export const REQUIRED_FILES_P0 = [
  "package.json",
  "babel.config.js",
  "metro.config.js",
  "tsconfig.json",
  "App.tsx",
  "index.js",
  "eas.json",
] as const;

export const REQUIRED_ASSETS_P0 = [
  "assets/icon.png",
  "assets/adaptive-icon.png",
  "assets/splash.png",
] as const;

export const REQUIRED_WORKFLOWS_P1 = [
  ".github/workflows/eas-build.yml",
  ".github/workflows/eas-link.yml",
] as const;
