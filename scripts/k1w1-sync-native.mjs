#!/usr/bin/env node
/**
 * k1w1-sync-native.mjs
 * - Scannt JS/TS Files nach Imports
 * - vergleicht mit package.json deps/devDeps
 * - erkennt Expo config plugins (app.json)
 * - erzeugt Report: scripts/.k1w1-native-autogen.json
 * - optional: --apply=true => installiert fehlende Packages (expo install / npm install)
 *
 * NOTE: Das ist "best-effort" Auto-Erkennung. 100% perfekt geht nur mit tieferem Build/Runtime-Graph.
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const cwd = process.cwd();

function argValue(name, def = null) {
  const hit = process.argv.find((a) => a === name || a.startsWith(`${name}=`));
  if (!hit) return def;
  if (hit.includes("=")) return hit.split("=").slice(1).join("=");
  const idx = process.argv.indexOf(hit);
  return process.argv[idx + 1] ?? def;
}

const applyRaw = argValue("--apply", "false");
const APPLY = String(applyRaw).toLowerCase() === "true" || applyRaw === "1" || applyRaw === true;

const OUT_PATH = path.join(cwd, "scripts", ".k1w1-native-autogen.json");

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function listFiles(dir, acc = []) {
  const skipDirs = new Set([
    "node_modules",
    ".git",
    ".expo",
    "dist",
    "build",
    "android",
    "ios",
    ".next",
    ".turbo",
    "web-build",
    "coverage",
  ]);

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (skipDirs.has(e.name)) continue;
      listFiles(full, acc);
    } else if (e.isFile()) {
      if (/\.(ts|tsx|js|jsx)$/.test(e.name)) acc.push(full);
    }
  }
  return acc;
}

function parseImports(code) {
  // import x from 'pkg'
  // import {x} from "pkg"
  // import 'pkg'
  // require('pkg')
  const pkgs = new Set();

  const importRe = /import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g;
  const sideEffectRe = /import\s+["']([^"']+)["']/g;
  const requireRe = /require\(\s*["']([^"']+)["']\s*\)/g;

  for (const re of [importRe, sideEffectRe, requireRe]) {
    let m;
    while ((m = re.exec(code))) {
      const spec = m[1];
      if (!spec) continue;
      if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("..")) continue;

      // normalize: @scope/name/sub -> @scope/name, pkg/sub -> pkg
      let pkg = spec;
      if (pkg.startsWith("@")) {
        const parts = pkg.split("/");
        if (parts.length >= 2) pkg = `${parts[0]}/${parts[1]}`;
      } else {
        pkg = pkg.split("/")[0];
      }
      pkgs.add(pkg);
    }
  }

  return [...pkgs];
}

function getExpoPlugins() {
  const appJsonPath = path.join(cwd, "app.json");
  if (!exists(appJsonPath)) return [];

  try {
    const appJson = readJson(appJsonPath);
    const plugins = appJson?.expo?.plugins ?? [];
    const out = [];

    for (const p of plugins) {
      if (typeof p === "string") out.push(p);
      else if (Array.isArray(p) && typeof p[0] === "string") out.push(p[0]);
    }
    return out;
  } catch {
    return [];
  }
}

function getPackageJsonDeps() {
  const pkgPath = path.join(cwd, "package.json");
  if (!exists(pkgPath)) throw new Error("package.json not found in project root.");
  const pkg = readJson(pkgPath);
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return { pkg, deps };
}

function detectPackageManager() {
  if (exists(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (exists(path.join(cwd, "yarn.lock"))) return "yarn";
  return "npm";
}

function run(cmd) {
  return execSync(cmd, { stdio: "pipe", cwd }).toString("utf8");
}

function runLive(cmd) {
  execSync(cmd, { stdio: "inherit", cwd });
}

const pm = detectPackageManager();
const startedAt = new Date().toISOString();

const report = {
  ok: true,
  startedAt,
  apply: APPLY,
  packageManager: pm,
  stats: {
    scannedFiles: 0,
    foundImports: 0,
    foundPlugins: 0,
    missingPackages: 0,
    installedPackages: 0,
    errors: 0,
  },
  found: {
    imports: [],
    expoPlugins: [],
  },
  installed: {
    deps: [],
  },
  missing: {
    deps: [],
  },
  actions: [],
  errors: [],
};

try {
  const { deps } = getPackageJsonDeps();

  // 1) scan files
  const files = listFiles(cwd);
  report.stats.scannedFiles = files.length;

  const importSet = new Set();
  for (const f of files) {
    try {
      const code = fs.readFileSync(f, "utf8");
      for (const p of parseImports(code)) importSet.add(p);
    } catch (e) {
      report.errors.push({ file: f, error: String(e?.message ?? e) });
    }
  }

  // remove noise packages
  const ignore = new Set([
    "react",
    "react-native",
    "expo",
    "@expo/vector-icons",
    "typescript",
    "tslib",
  ]);

  for (const i of ignore) importSet.delete(i);

  const imports = [...importSet].sort();
  report.found.imports = imports;
  report.stats.foundImports = imports.length;

  // 2) expo plugins
  const plugins = getExpoPlugins();
  report.found.expoPlugins = plugins;
  report.stats.foundPlugins = plugins.length;

  // 3) required packages = imports + plugins (plugins usually equal package name)
  const required = new Set([...imports, ...plugins]);

  // 4) missing
  const missing = [];
  const installed = [];
  for (const p of required) {
    if (!p) continue;
    if (deps[p]) installed.push(p);
    else missing.push(p);
  }

  report.installed.deps = installed.sort();
  report.missing.deps = missing.sort();
  report.stats.missingPackages = missing.length;
  report.stats.installedPackages = installed.length;

  // 5) apply install
  if (APPLY && missing.length > 0) {
    for (const pkg of missing) {
      // expo install for expo-* and a few common RN native deps under Expo
      const isExpoFamily =
        pkg.startsWith("expo-") ||
        pkg === "react-native-reanimated" ||
        pkg === "react-native-gesture-handler" ||
        pkg === "react-native-screens" ||
        pkg === "react-native-safe-area-context" ||
        pkg === "react-native-webview";

      try {
        if (isExpoFamily) {
          report.actions.push({ pkg, cmd: `npx expo install ${pkg}`, kind: "expo-install" });
          runLive(`npx expo install ${pkg}`);
        } else {
          const cmd =
            pm === "yarn"
              ? `yarn add ${pkg}`
              : pm === "pnpm"
                ? `pnpm add ${pkg}`
                : `npm install ${pkg}`;
          report.actions.push({ pkg, cmd, kind: "pm-install" });
          runLive(cmd);
        }
      } catch (e) {
        report.ok = false;
        report.stats.errors += 1;
        report.errors.push({ pkg, error: String(e?.message ?? e) });
      }
    }
  }

  writeJson(OUT_PATH, report);
  console.log(`[k1w1-sync-native] Report written: ${OUT_PATH}`);
  console.log(`[k1w1-sync-native] Missing: ${report.missing.deps.length}`);
  process.exit(report.ok ? 0 : 1);
} catch (e) {
  report.ok = false;
  report.stats.errors += 1;
  report.errors.push({ error: String(e?.message ?? e) });
  try {
    writeJson(OUT_PATH, report);
  } catch {}
  console.error(`[k1w1-sync-native] FAILED: ${String(e?.message ?? e)}`);
  process.exit(1);
}
