// lib/templateChecklist.ts
// Harte Template-Checkliste (SDK 54 / Android-only / EAS-ready / Preview-friendly)
// Ziel: Kein frisch erstelltes Projekt darf "halbkaputt" entstehen.

import type { ProjectFile } from "../contexts/types";
import { normalizePath } from "./validators";

export type ChecklistSeverity = "P0" | "P1" | "P2";

export type ChecklistItem = {
  severity: ChecklistSeverity;
  file?: string;
  reason: string;
  fix?: string;
};

// Internal helper map for quick lookup/mutation during autofix.
type TemplateFileMap = Record<string, string>;

export type TemplateChecklistReport = {
  ok: boolean;
  issues: ChecklistItem[];
  summary: string;
};

export type TemplateChecklistOptions = {
  autofix?: boolean;
  toolchain?: {
    expo: string;       // e.g. "~54.0.32"
    react: string;      // e.g. "19.1.0"
    reactDom: string;   // e.g. "19.1.0"
    reactNative: string;// e.g. "0.81.5"
    jestExpo?: string;  // e.g. "~54.0.16"
  };
};

const DEFAULT_TOOLCHAIN = {
  expo: "~54.0.32",
  react: "19.1.0",
  reactDom: "19.1.0",
  reactNative: "0.81.5",
  jestExpo: "~54.0.16",
};

// 1x1 PNG (transparent) – real binary, tiny, valid for Expo asset existence checks
const PNG_1x1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6Xgmf8AAAAASUVORK5CYII=";

const REQUIRED_FILES_P0 = [
  "package.json",
  "babel.config.js",
  "metro.config.js",
  "tsconfig.json",
  "App.tsx",
  "index.js",
  "eas.json",
] as const;

const REQUIRED_ASSETS_P0 = [
  "assets/icon.png",
  "assets/adaptive-icon.png",
  "assets/splash.png",
] as const;

const REQUIRED_WORKFLOWS_P1 = [
  ".github/workflows/eas-build.yml",
  ".github/workflows/eas-link.yml",
] as const;

/**
 * ✅ Harte Checkliste für Templates / frisch generierte Projekte.
 * - Prüft required files
 * - erzwingt Android-only Expo config
 * - pinned Toolchain (Expo SDK 54 / React 19 / RN 0.81)
 * - EAS Profiles vorhanden
 * - minimale Assets vorhanden
 *
 * Wenn autofix=true: fügt fehlende Dateien/Defaults hinzu und patched package/app/eas config.
 */
export function runTemplateHardChecklist(
  files: ProjectFile[],
  options: TemplateChecklistOptions = {},
): { files: ProjectFile[]; report: TemplateChecklistReport } {
  const toolchain = { ...DEFAULT_TOOLCHAIN, ...(options.toolchain ?? {}) };

  const issues: ChecklistItem[] = [];
  const autofix = !!options.autofix;

  const map = new Map<string, ProjectFile>();
  for (const f of files ?? []) {
    const p = normalizePath(String(f?.path ?? ""));
    if (!p) continue;
    const c = typeof f?.content === "string" ? f.content : String((f as any)?.content ?? "");
    map.set(p, { path: p, content: c });
  }

  const has = (p: string) => map.has(normalizePath(p));
  const get = (p: string) => map.get(normalizePath(p))?.content ?? "";
  const set = (p: string, content: string) => map.set(normalizePath(p), { path: normalizePath(p), content });

  // --- required root files ---
  for (const p of REQUIRED_FILES_P0) {
    if (!has(p)) {
      issues.push({
        severity: "P0",
        file: p,
        reason: `Pflichtdatei fehlt: ${p}`,
        fix: autofix ? "Wird als minimaler Default ergänzt." : "Datei im Template ergänzen.",
      });
      if (autofix) set(p, minimalDefaultFor(p));
    }
  }

  // --- required assets ---
  for (const p of REQUIRED_ASSETS_P0) {
    if (!has(p)) {
      issues.push({
        severity: "P0",
        file: p,
        reason: `Pflicht-Asset fehlt: ${p}`,
        fix: autofix ? "Wird als Base64-PNG ergänzt." : "Asset ins Template aufnehmen.",
      });
      if (autofix) set(p, `base64:${PNG_1x1_BASE64}`);
    }
  }

  // --- recommended workflows ---
  for (const p of REQUIRED_WORKFLOWS_P1) {
    if (!has(p)) {
      issues.push({
        severity: "P1",
        file: p,
        reason: `Workflow fehlt: ${p} (1-Click Build/Link kann fehlen)`,
        fix: "Workflow aus Core-Template/Repo übernehmen.",
      });
    }
  }

  // --- package.json sanity + pinned toolchain ---
  if (has("package.json")) {
    const raw = get("package.json");
    const { next, changed, parseOk, parseError, p0 } = patchPackageJson(raw, toolchain);
    if (!parseOk) {
      issues.push({
        severity: "P0",
        file: "package.json",
        reason: `package.json ist kein gültiges JSON (${parseError ?? "parse error"})`,
        fix: "package.json reparieren (valid JSON).",
      });
      if (autofix) set("package.json", next);
    } else {
      if (p0.length) issues.push(...p0);
      if (autofix && changed) set("package.json", next);
    }
  }

  // --- Expo config: prefer app.json; patch app.config.js if that's used ---
  const hasAppJson = has("app.json");
  const hasAppConfigJs = has("app.config.js");

  if (!hasAppJson && !hasAppConfigJs) {
    issues.push({
      severity: "P0",
      file: "app.json",
      reason: "Weder app.json noch app.config.js vorhanden (Expo Config fehlt).",
      fix: autofix ? "app.json wird ergänzt." : "app.json oder app.config.js hinzufügen.",
    });
    if (autofix) set("app.json", JSON.stringify(minimalAppJson(), null, 2));
  }

  if (hasAppJson) {
    const raw = get("app.json");
    const { next, changed, parseOk, parseError, p0 } = patchAppJson(raw);
    if (!parseOk) {
      issues.push({
        severity: "P0",
        file: "app.json",
        reason: `app.json ist kein gültiges JSON (${parseError ?? "parse error"})`,
        fix: "app.json reparieren (valid JSON).",
      });
      if (autofix) set("app.json", next);
    } else {
      if (p0.length) issues.push(...p0);
      if (autofix && changed) set("app.json", next);
    }
  } else if (hasAppConfigJs) {
    const raw = get("app.config.js");
    const { next, changed, p0, p1 } = patchAppConfigJs(raw, autofix);
    if (p0.length) issues.push(...p0);
    if (p1.length) issues.push(...p1);
    if (autofix && changed) set("app.config.js", next);
  }

  // --- eas.json sanity ---
  if (has("eas.json")) {
    const raw = get("eas.json");
    const { next, changed, parseOk, parseError, p0 } = patchEasJson(raw);
    if (!parseOk) {
      issues.push({
        severity: "P0",
        file: "eas.json",
        reason: `eas.json ist kein gültiges JSON (${parseError ?? "parse error"})`,
        fix: "eas.json reparieren (valid JSON).",
      });
      if (autofix) set("eas.json", next);
    } else {
      if (p0.length) issues.push(...p0);
      if (autofix && changed) set("eas.json", next);
    }
  }

  // --- ensure .easignore (optional but strongly recommended) ---
  if (!has(".easignore")) {
    issues.push({
      severity: "P2",
      file: ".easignore",
      reason: ".easignore fehlt (Uploads können unnötig groß werden / EPERM-Probleme wahrscheinlicher).",
      fix: autofix ? "Wird ergänzt." : "Datei hinzufügen.",
    });
    if (autofix) set(".easignore", defaultEasIgnore());
  }

  // --- final: build output ---
  const out: ProjectFile[] = [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
  const p0Count = issues.filter((i) => i.severity === "P0").length;
  const p1Count = issues.filter((i) => i.severity === "P1").length;
  const p2Count = issues.filter((i) => i.severity === "P2").length;

  const ok = p0Count === 0;
  const summary = `Template-Check: ${ok ? "OK" : "NICHT OK"} (P0=${p0Count}, P1=${p1Count}, P2=${p2Count})`;

  return { files: out, report: { ok, issues, summary } };
}

// -------------------- Patchers --------------------

function patchPackageJson(
  raw: string,
  toolchain: typeof DEFAULT_TOOLCHAIN,
): {
  next: string;
  changed: boolean;
  parseOk: boolean;
  parseError?: string;
  p0: ChecklistItem[];
} {
  const p0: ChecklistItem[] = [];
  let changed = false;

  try {
    const pkg = JSON.parse(raw || "{}");
    if (!pkg || typeof pkg !== "object") throw new Error("not object");

    pkg.dependencies = ensureObj(pkg.dependencies);
    pkg.devDependencies = ensureObj(pkg.devDependencies);
    pkg.scripts = ensureObj(pkg.scripts);

    // required scripts
    const requiredScripts: Record<string, string> = {
      start: "expo start",
      android: "expo start --android",
      typecheck: "tsc --noEmit",
      "lint:ci": "eslint . --quiet",
      "test:silent": "jest --runInBand",
    };

    for (const [k, v] of Object.entries(requiredScripts)) {
      if (typeof pkg.scripts[k] !== "string" || !pkg.scripts[k]) {
        pkg.scripts[k] = v;
        changed = true;
      }
    }

    // required deps
    changed = upsertDep(pkg.dependencies, "expo", toolchain.expo) || changed;
    changed = upsertDep(pkg.dependencies, "react", toolchain.react) || changed;
    changed = upsertDep(pkg.dependencies, "react-native", toolchain.reactNative) || changed;

    // For preview/web tooling – harmless even on Android-only (doesn't affect native build)
    if (typeof pkg.dependencies["react-dom"] !== "string") {
      pkg.dependencies["react-dom"] = toolchain.reactDom;
      changed = true;
    }

    // required dev deps
    if (typeof pkg.devDependencies["jest-expo"] !== "string") {
      pkg.devDependencies["jest-expo"] = toolchain.jestExpo;
      changed = true;
    }
    if (typeof pkg.devDependencies["typescript"] !== "string") {
      pkg.devDependencies["typescript"] = "^5.8.0";
      changed = true;
    }
    if (typeof pkg.devDependencies["@types/react"] !== "string") {
      pkg.devDependencies["@types/react"] = "^19.0.0";
      changed = true;
    }

    // sanity: expo/react/rn majors
    const majExpo = majorOf(pkg.dependencies["expo"]);
    const majReact = majorOf(pkg.dependencies["react"]);
    const majRN = majorOf(pkg.dependencies["react-native"]);
    if (majExpo !== 54) {
      p0.push({
        severity: "P0",
        file: "package.json",
        reason: `Expo SDK Mismatch (expo=${String(pkg.dependencies["expo"])}; erwartet 54.x)`,
        fix: `Setze expo auf ${toolchain.expo}`,
      });
    }
    if (majReact !== 19) {
      p0.push({
        severity: "P0",
        file: "package.json",
        reason: `React Mismatch (react=${String(pkg.dependencies["react"])}; erwartet 19.x)`,
        fix: `Setze react auf ${toolchain.react}`,
      });
    }
    if (majRN !== 0 || !String(pkg.dependencies["react-native"] ?? "").includes("0.81")) {
      p0.push({
        severity: "P0",
        file: "package.json",
        reason: `React-Native Mismatch (react-native=${String(pkg.dependencies["react-native"])}; erwartet 0.81.x)`,
        fix: `Setze react-native auf ${toolchain.reactNative}`,
      });
    }

    const next = JSON.stringify(pkg, null, 2);
    return { next, changed, parseOk: true, p0 };
  } catch (e: any) {
    // fallback minimal package.json
    const fallback = {
      name: "app",
      version: "1.0.0",
      main: "index.js",
      scripts: {
        start: "expo start",
        android: "expo start --android",
        typecheck: "tsc --noEmit",
        "lint:ci": "eslint . --quiet",
        "test:silent": "jest --runInBand",
      },
      dependencies: {
        expo: toolchain.expo,
        react: toolchain.react,
        "react-native": toolchain.reactNative,
        "react-dom": toolchain.reactDom,
      },
      devDependencies: {
        "jest-expo": toolchain.jestExpo,
        typescript: "^5.8.0",
        "@types/react": "^19.0.0",
      },
    };
    return {
      next: JSON.stringify(fallback, null, 2),
      changed: true,
      parseOk: false,
      parseError: e?.message ? String(e.message) : "parse failed",
      p0,
    };
  }
}

function patchAppJson(
  raw: string,
): {
  next: string;
  changed: boolean;
  parseOk: boolean;
  parseError?: string;
  p0: ChecklistItem[];
} {
  const p0: ChecklistItem[] = [];
  let changed = false;

  try {
    const obj = JSON.parse(raw || "{}");
    const expo = ensureObj(obj.expo);

    // Android-only policy
    if (!Array.isArray(expo.platforms) || expo.platforms.join(",") !== "android") {
      expo.platforms = ["android"];
      changed = true;
    }

    if (expo.newArchEnabled !== true) {
      expo.newArchEnabled = true;
      changed = true;
    }

    expo.android = ensureObj(expo.android);
    if (typeof expo.android.package !== "string" || expo.android.package.trim().length < 8) {
      p0.push({
        severity: "P0",
        file: "app.json",
        reason: "expo.android.package fehlt oder ist ungültig (mind. com.x.y).",
        fix: "Setze package via UI/Generator (z.B. com.k1w1.app).",
      });
    }

    // Ensure referenced assets exist (paths only; existence checked elsewhere)
    if (typeof expo.icon !== "string") {
      expo.icon = "./assets/icon.png";
      changed = true;
    }
    expo.splash = ensureObj(expo.splash);
    if (typeof expo.splash.image !== "string") {
      expo.splash.image = "./assets/splash.png";
      changed = true;
    }
    if (typeof expo.splash.resizeMode !== "string") {
      expo.splash.resizeMode = "contain";
      changed = true;
    }
    if (typeof expo.splash.backgroundColor !== "string") {
      expo.splash.backgroundColor = "#ffffff";
      changed = true;
    }

    expo.android.adaptiveIcon = ensureObj(expo.android.adaptiveIcon);
    if (typeof expo.android.adaptiveIcon.foregroundImage !== "string") {
      expo.android.adaptiveIcon.foregroundImage = "./assets/adaptive-icon.png";
      changed = true;
    }
    if (typeof expo.android.adaptiveIcon.backgroundColor !== "string") {
      expo.android.adaptiveIcon.backgroundColor = "#ffffff";
      changed = true;
    }

    obj.expo = expo;
    const next = JSON.stringify(obj, null, 2);
    return { next, changed, parseOk: true, p0 };
  } catch (e: any) {
    const next = JSON.stringify(minimalAppJson(), null, 2);
    return {
      next,
      changed: true,
      parseOk: false,
      parseError: e?.message ? String(e.message) : "parse failed",
      p0,
    };
  }
}

function patchAppConfigJs(
  raw: string,
  autofix: boolean,
): { next: string; changed: boolean; p0: ChecklistItem[]; p1: ChecklistItem[] } {
  const p0: ChecklistItem[] = [];
  const p1: ChecklistItem[] = [];
  let out = raw || "";
  let changed = false;

  // 1) platforms: ['android'] is REQUIRED for this project (Android-only policy)
  if (/\bplatforms\s*:\s*\[[^\]]*\]/m.test(out)) {
    const next = out.replace(/\bplatforms\s*:\s*\[[^\]]*\]/m, "platforms: ['android']");
    if (next !== out) {
      out = next;
      changed = true;
    }
  } else {
    const msg: ChecklistItem = {
      severity: "P0",
      file: "app.config.js",
      reason: "Android-only Policy: platforms fehlt in app.config.js",
      fix: "platforms: ['android'] ergänzen.",
    };
    if (autofix) {
      // Insert right after `expo: {`
      const next = out.replace(/\bexpo\s*:\s*\{/m, (s) => `${s}\n    platforms: ['android'],`);
      if (next !== out) {
        out = next;
        changed = true;
      } else {
        // If insertion failed (unexpected structure), keep as P0
        p0.push(msg);
      }
    } else {
      p0.push(msg);
    }
  }

  // 2) newArchEnabled: true (recommended, but we enforce to avoid drift)
  if (/\bnewArchEnabled\s*:\s*false\b/m.test(out)) {
    out = out.replace(/\bnewArchEnabled\s*:\s*false\b/m, "newArchEnabled: true");
    changed = true;
  } else if (!/\bnewArchEnabled\s*:\s*true\b/m.test(out)) {
    const msg: ChecklistItem = {
      severity: "P1",
      file: "app.config.js",
      reason: "newArchEnabled nicht gefunden – SDK54 empfohlen.",
      fix: "newArchEnabled: true setzen.",
    };
    if (autofix) {
      const next = out.replace(/\bexpo\s*:\s*\{/m, (s) => `${s}\n    newArchEnabled: true,`);
      if (next !== out) {
        out = next;
        changed = true;
      } else {
        p1.push(msg);
      }
    } else {
      p1.push(msg);
    }
  }

  // 3) icon: './assets/icon.png'
  if (!/\bicon\s*:\s*['"][^'"]+['"]/m.test(out)) {
    const msg: ChecklistItem = {
      severity: "P1",
      file: "app.config.js",
      reason: "icon fehlt – Expo/EAS kann Assets nicht finden.",
      fix: "icon: './assets/icon.png' ergänzen.",
    };
    if (autofix) {
      const next = out.replace(/\bexpo\s*:\s*\{/m, (s) => `${s}\n    icon: './assets/icon.png',`);
      if (next !== out) {
        out = next;
        changed = true;
      } else {
        p1.push(msg);
      }
    } else {
      p1.push(msg);
    }
  }

  // 4) splash.image: './assets/splash.png' (ensure if splash block exists)
  if (/\bsplash\s*:\s*\{/m.test(out) && !/\bsplash\s*:\s*\{[\s\S]*?\bimage\s*:/m.test(out)) {
    const msg: ChecklistItem = {
      severity: "P1",
      file: "app.config.js",
      reason: "splash.image fehlt – Preview/Build kann inkonsistent sein.",
      fix: "splash: { image: './assets/splash.png', ... } ergänzen.",
    };
    if (autofix) {
      const next = out.replace(/\bsplash\s*:\s*\{/m, (s) => `${s}\n      image: './assets/splash.png',`);
      if (next !== out) {
        out = next
        changed = true;
      } else {
        p1.push(msg);
      }
    } else {
      p1.push(msg);
    }
  }

  // 5) android.adaptiveIcon.foregroundImage
  if (/\badaptiveIcon\s*:\s*\{/m.test(out) && !/\badaptiveIcon\s*:\s*\{[\s\S]*?\bforegroundImage\s*:/m.test(out)) {
    const msg: ChecklistItem = {
      severity: "P1",
      file: "app.config.js",
      reason: "android.adaptiveIcon.foregroundImage fehlt – AdaptiveIcon kann fehlen.",
      fix: "foregroundImage: './assets/adaptive-icon.png' ergänzen.",
    };
    if (autofix) {
      const next = out.replace(/\badaptiveIcon\s*:\s*\{/m, (s) => `${s}\n        foregroundImage: './assets/adaptive-icon.png',`);
      if (next !== out) {
        out = next
        changed = true;
      } else {
        p1.push(msg);
      }
    } else {
      p1.push(msg);
    }
  }

  // 6) android.package required (can't safely fix automatically)
  if (!/\bpackage\s*:\s*['"][a-z0-9.]+['"]/m.test(out)) {
    p0.push({
      severity: "P0",
      file: "app.config.js",
      reason: "expo.android.package fehlt oder ist nicht erkennbar.",
      fix: "android: { package: 'com.yourcompany.app' } setzen.",
    });
  }

  return { next: out, changed, p0, p1 };
}

function patchEasJson(
  raw: string,
): {
  next: string;
  changed: boolean;
  parseOk: boolean;
  parseError?: string;
  p0: ChecklistItem[];
} {
  const p0: ChecklistItem[] = [];
  let changed = false;

  try {
    const obj = JSON.parse(raw || "{}");
    obj.cli = ensureObj(obj.cli);
    if (obj.cli.appVersionSource !== "remote") {
      obj.cli.appVersionSource = "remote";
      changed = true;
    }

    obj.build = ensureObj(obj.build);

    // Required profiles: preview + production
    const needProfiles = [
      { name: "preview", defaults: { android: { buildType: "apk" } } },
      { name: "production", defaults: { android: { buildType: "app-bundle" } } },
    ] as const;

    for (const p of needProfiles) {
      if (!obj.build[p.name] || typeof obj.build[p.name] !== "object") {
        obj.build[p.name] = p.defaults as any;
        changed = true;
        p0.push({
          severity: "P0",
          file: "eas.json",
          reason: `EAS Profile fehlt: build.${p.name}`,
          fix: `Profile build.${p.name} hinzufügen.`,
        });
      }
    }

    const next = JSON.stringify(obj, null, 2);
    return { next, changed, parseOk: true, p0 };
  } catch (e: any) {
    const fallback = {
      cli: { appVersionSource: "remote" },
      build: {
        preview: { android: { buildType: "apk" } },
        production: { android: { buildType: "app-bundle" } },
      },
    };
    return {
      next: JSON.stringify(fallback, null, 2),
      changed: true,
      parseOk: false,
      parseError: e?.message ? String(e.message) : "parse failed",
      p0,
    };
  }
}

// -------------------- Defaults --------------------

function minimalDefaultFor(path: string): string {
  switch (normalizePath(path)) {
    case "babel.config.js":
      return `module.exports = function(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
`;
    case "metro.config.js":
      return `const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config;
`;
    case "tsconfig.json":
      return JSON.stringify(
        {
          extends: "expo/tsconfig.base",
          compilerOptions: {
            strict: true,
            noEmit: true,
          },
        },
        null,
        2,
      );
    case "index.js":
      return `import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
`;
    case "App.tsx":
      return `import React from 'react';
import { View, Text } from 'react-native';

export default function App(){
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>APK Builder - New Project</Text>
    </View>
  );
}
`;
    case "eas.json":
      return JSON.stringify(
        {
          cli: { appVersionSource: "remote" },
          build: {
            preview: { android: { buildType: "apk" } },
            production: { android: { buildType: "app-bundle" } },
          },
        },
        null,
        2,
      );
    case "package.json":
      return JSON.stringify(
        {
          name: "app",
          version: "1.0.0",
          main: "index.js",
          scripts: {
            start: "expo start",
            android: "expo start --android",
            typecheck: "tsc --noEmit",
            "lint:ci": "eslint . --quiet",
            "test:silent": "jest --runInBand",
          },
          dependencies: {
            expo: DEFAULT_TOOLCHAIN.expo,
            react: DEFAULT_TOOLCHAIN.react,
            "react-native": DEFAULT_TOOLCHAIN.reactNative,
            "react-dom": DEFAULT_TOOLCHAIN.reactDom,
          },
          devDependencies: {
            "jest-expo": DEFAULT_TOOLCHAIN.jestExpo,
            typescript: "^5.8.0",
            "@types/react": "^19.0.0",
          },
        },
        null,
        2,
      );
    default:
      return "";
  }
}

function minimalAppJson() {
  return {
    expo: {
      name: "My App",
      slug: "my-app",
      version: "1.0.0",
      platforms: ["android"],
      newArchEnabled: true,
      icon: "./assets/icon.png",
      splash: {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
      android: {
        package: "com.example.app",
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#ffffff",
        },
      },
      assetBundlePatterns: ["**/*"],
    },
  };
}

function defaultEasIgnore(): string {
  return [
    ".git",
    "node_modules",
    "android",
    "ios",
    ".expo",
    ".cache",
    "dist",
    "build",
    ".DS_Store",
  ].join("\n") + "\n";
}

// -------------------- helpers --------------------

function ensureObj(value: any): any {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function upsertDep(obj: any, name: string, version: string): boolean {
  if (!obj || typeof obj !== "object") return false;
  if (obj[name] !== version) {
    obj[name] = version;
    return true;
  }
  return false;
}

function majorOf(v: any): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/(\d+)\./);
  if (!m) return null;
  return Number(m[1]);
}

function ensureAppConfigFile(files: TemplateFileMap): TemplateFileMap {
  const hasAppJson = !!files["app.json"];
  const hasAppConfig = !!files["app.config.js"];
  if (hasAppJson || hasAppConfig) return files;

  // Default to app.config.js so we can support per-profile "on-the-fly" config via APP_VARIANT.
  const content = `// Auto-generated fallback (Android-only)\n` +
    `const getVariant = () => {\n` +
    `  const v = process.env.APP_VARIANT || process.env.BUILD_PROFILE || process.env.EAS_BUILD_PROFILE || "preview";\n` +
    `  return String(v).toLowerCase();\n` +
    `};\n\n` +
    `module.exports = ({ config }) => {\n` +
    `  const variant = getVariant();\n` +
    `  const isDev = variant === "development";\n` +
    `  return {\n` +
    `    expo: {\n` +
    `      ...config,\n` +
    `      platforms: ["android"],\n` +
    `      updates: { ...(config.updates || {}), enabled: !isDev },\n` +
    `      extra: { ...(config.extra || {}), appVariant: variant },\n` +
    `    },\n` +
    `  };\n` +
    `};\n`;
  return { ...files, ["app.config.js"]: content };
}


