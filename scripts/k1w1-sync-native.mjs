#!/usr/bin/env node
/**
 * K1W1 Native Dependency Auto-Detect
 *
 * Goal:
 * - scan your JS/TS source for imports that imply native modules
 * - auto-install missing deps (expo install / npm install) when --apply is used
 * - generate scripts/.k1w1-native-autogen.json with config plugins list
 *
 * Usage:
 *   node scripts/k1w1-sync-native.mjs           # report only
 *   node scripts/k1w1-sync-native.mjs --apply   # install + generate autogen file
 *
 * Notes:
 * - Expo SDK packages should be installed using `expo install` to match SDK versions.
 * - Third-party native packages may need additional manual config (we just npm install them).
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const APPLY = process.argv.includes("--apply");
const VERBOSE = process.argv.includes("--verbose");

const MAP_PATH = path.join(ROOT, "scripts", "k1w1-native-map.json");
const OUT_PATH = path.join(ROOT, "scripts", ".k1w1-native-autogen.json");

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".expo",
  ".expo-shared",
  "android",
  "ios",
  "dist",
  "web-build",
  "build",
  "coverage",
  "supabase",
  "backups",
]);

const FILE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

function log(...args) {
  if (VERBOSE) console.log(...args);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function listSourceFiles(dir) {
  const out = [];
  const stack = [dir];

  while (stack.length) {
    const cur = stack.pop();
    if (!cur) continue;

    const rel = path.relative(ROOT, cur);
    if (rel && IGNORE_DIRS.has(rel.split(path.sep)[0])) continue;

    const stat = fs.statSync(cur);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(cur);
      for (const e of entries) {
        stack.push(path.join(cur, e));
      }
    } else if (stat.isFile()) {
      const ext = path.extname(cur);
      if (FILE_EXTS.has(ext)) out.push(cur);
    }
  }

  return out;
}

const IMPORT_RE =
  /(?:import\s+(?:["'\s]*[\w*{}\n\r\t, ]+from\s+)?|require\s*\()\s*["']([^"']+)["']\s*\)?/g;

function extractModules(code) {
  const mods = new Set();
  let m;
  while ((m = IMPORT_RE.exec(code))) {
    const spec = m[1];
    if (!spec) continue;
    if (spec.startsWith(".") || spec.startsWith("/")) continue; // relative
    if (spec === "react" || spec === "react-native") continue;

    const base = spec.startsWith("@")
      ? spec.split("/").slice(0, 2).join("/")
      : spec.split("/")[0];

    mods.add(base);
  }
  return mods;
}

function uniquePlugins(plugins) {
  const seen = new Set();
  const out = [];
  for (const p of plugins) {
    const key = JSON.stringify(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function getInstalledPackages() {
  const pkgPath = path.join(ROOT, "package.json");
  const pkg = readJson(pkgPath);
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return deps;
}

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

function main() {
  if (!fs.existsSync(MAP_PATH)) {
    console.error(`Missing mapping file: ${MAP_PATH}`);
    process.exit(1);
  }

  const map = readJson(MAP_PATH);
  const files = listSourceFiles(ROOT);

  const detected = new Set();
  const allExternal = new Set();

  for (const f of files) {
    const code = fs.readFileSync(f, "utf8");
    const mods = extractModules(code);
    for (const mod of mods) {
      allExternal.add(mod);
      if (map[mod]) detected.add(mod); // known native-ish mapping
    }
  }

  const detectedList = Array.from(detected).sort();
  const allExternalList = Array.from(allExternal).sort();
  const installed = getInstalledPackages();

  const missingExpo = [];
  const missingNpm = [];
  const missingUnknownExpo = [];
  const missingUnknownNpm = [];

  const plugins = [];

  // Known mapped packages
  for (const mod of detectedList) {
    const cfg = map[mod];
    if (!installed[mod]) {
      if (cfg.install === "expo") missingExpo.push(mod);
      else if (cfg.install === "npm") missingNpm.push(mod);
    }
    if (Array.isArray(cfg.plugins)) {
      for (const p of cfg.plugins) plugins.push(p);
    }
  }

  // Generic fallback: any missing import gets installed too (future-proof)
  for (const mod of allExternalList) {
    if (installed[mod]) continue;
    if (map[mod]) continue; // already handled above

    // Heuristic: expo-* should be installed via expo install
    if (mod.startsWith("expo-")) missingUnknownExpo.push(mod);
    else missingUnknownNpm.push(mod);
  }

  const autogen = {
    generatedAt: new Date().toISOString(),
    detected: detectedList.map((m) => ({ name: m, ...map[m] })),
    missing: { expo: missingExpo, npm: missingNpm, unknownExpo: missingUnknownExpo, unknownNpm: missingUnknownNpm },
    plugins: uniquePlugins(plugins),
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(autogen, null, 2), "utf8");

  console.log("\n🧩 K1W1 Native Auto-Detect");
  console.log(`- Detected native-ish packages: ${detectedList.length}`);
  if (detectedList.length) console.log(`  ${detectedList.join(", ")}`);

  if (missingExpo.length || missingNpm.length || missingUnknownExpo.length || missingUnknownNpm.length) {
    console.log("\n⚠️ Missing packages:");
    if (missingExpo.length) console.log(`- expo install (mapped): ${missingExpo.join(", ")}`);
    if (missingNpm.length) console.log(`- npm install (mapped):  ${missingNpm.join(", ")}`);
    if (missingUnknownExpo.length) console.log(`- expo install (auto):  ${missingUnknownExpo.join(", ")}`);
    if (missingUnknownNpm.length) console.log(`- npm install (auto):   ${missingUnknownNpm.join(", ")}`);
  } else {
    console.log("\n✅ No missing packages detected.");
  }

  console.log(`\n🧾 Wrote: ${path.relative(ROOT, OUT_PATH)}`);
  console.log(`🔌 Plugins: ${autogen.plugins.length}`);

  if (!APPLY) {
    console.log("\nℹ️ Run with --apply to auto-install missing packages.");
    return;
  }

  if (missingExpo.length) {
    run(`npx expo install ${missingExpo.join(" ")}`);
  }
  if (missingUnknownExpo.length) {
    run(`npx expo install ${missingUnknownExpo.join(" ")}`);
  }
  if (missingNpm.length) {
    run(`npm install ${missingNpm.join(" ")}`);
  }
  if (missingUnknownNpm.length) {
    run(`npm install ${missingUnknownNpm.join(" ")}`);
  }

  console.log("\n✅ Applied missing dependency installs.");
}

main();
