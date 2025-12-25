#!/usr/bin/env node
/**
 * K1W1 Native Sync – scan project files for native-ish deps and ensure they're installed.
 * Writes autogen report: scripts/.k1w1-native-autogen.json
 *
 * Flags:
 *   --apply       actually installs missing deps
 *   --apply=true  same
 *   --apply=false report only
 */

import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const PROJECT_ROOT = process.cwd();
const MAP_PATH = path.join(PROJECT_ROOT, "scripts", "k1w1-native-map.json");
const REPORT_PATH = path.join(PROJECT_ROOT, "scripts", ".k1w1-native-autogen.json");

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function walk(dir, out = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      if (it.name === "node_modules" || it.name === ".git" || it.name === "android" || it.name === "ios") continue;
      walk(full, out);
    } else {
      if (
        it.name.endsWith(".ts") ||
        it.name.endsWith(".tsx") ||
        it.name.endsWith(".js") ||
        it.name.endsWith(".jsx") ||
        it.name.endsWith(".json") ||
        it.name.endsWith(".mjs") ||
        it.name.endsWith(".cjs")
      ) {
        out.push(full);
      }
    }
  }
  return out;
}

function uniqPlugins(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function isLocalPluginRef(name) {
  if (!name) return false;
  return (
    name.startsWith("./") ||
    name.startsWith("../") ||
    name.startsWith("/") ||
    name.endsWith(".js") ||
    name.endsWith(".cjs") ||
    name.endsWith(".mjs")
  );
}

function getPluginName(entry) {
  if (Array.isArray(entry)) return String(entry[0] ?? "");
  return String(entry ?? "");
}

/**
 * Expo Config Plugins exist only if the package contains app.plugin.(js|cjs|mjs),
 * or the plugin ref is a local path.
 */
function hasAppPluginFile(pkgName) {
  if (!pkgName || isLocalPluginRef(pkgName)) return true;

  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [PROJECT_ROOT] });
    const root = path.dirname(pkgJsonPath);
    const candidates = ["app.plugin.js", "app.plugin.cjs", "app.plugin.mjs"];
    return candidates.some((f) => fs.existsSync(path.join(root, f)));
  } catch {
    return false;
  }
}

function filterValidConfigPlugins(entries) {
  const valid = [];
  const skipped = [];

  for (const entry of entries) {
    const name = getPluginName(entry);
    if (!name) continue;

    if (hasAppPluginFile(name)) valid.push(entry);
    else skipped.push(name);
  }

  return { valid, skipped };
}

function readPackageJson() {
  const p = path.join(PROJECT_ROOT, "package.json");
  return readJSON(p);
}

function hasDep(pkgJson, name) {
  return Boolean(pkgJson?.dependencies?.[name] || pkgJson?.devDependencies?.[name]);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    cwd: PROJECT_ROOT,
    ...opts,
  });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (${res.status})`);
  }
}

function parseApplyFlag() {
  const arg = process.argv.find((x) => x.startsWith("--apply"));
  if (!arg) return false;
  const parts = arg.split("=");
  if (parts.length === 1) return true;
  return parts[1].trim().toLowerCase() === "true";
}

function main() {
  const apply = parseApplyFlag();

  if (!fs.existsSync(MAP_PATH)) {
    console.error("Missing map file:", MAP_PATH);
    process.exit(1);
  }

  const MAP = readJSON(MAP_PATH);

  const files = walk(PROJECT_ROOT);
  const detected = [];

  for (const [pkgName, cfg] of Object.entries(MAP)) {
    const token = pkgName.replace("/", "\\/"); // escape for regex
    const re = new RegExp(`(['"\`]|\\b)${token}(['"\`]|\\b)`, "i");

    let hit = false;
    for (const f of files) {
      let txt = "";
      try {
        txt = fs.readFileSync(f, "utf8");
      } catch {
        continue;
      }
      if (re.test(txt)) {
        hit = true;
        break;
      }
    }

    if (hit) {
      detected.push({
        name: pkgName,
        install: cfg.install || "expo",
        plugins: cfg.plugins || [],
        reason: cfg.reason || "Detected usage",
      });
    }
  }

  const pkgJson = readPackageJson();

  const missingExpo = [];
  const missingNpm = [];

  for (const d of detected) {
    if (!hasDep(pkgJson, d.name)) {
      if (d.install === "expo") missingExpo.push(d.name);
      else missingNpm.push(d.name);
    }
  }

  // Build plugins list (BUT filter to only real Expo config plugins)
  const allPlugins = uniqPlugins(detected.flatMap((d) => d.plugins || []));
  const { valid: validPlugins, skipped: skippedPlugins } = filterValidConfigPlugins(allPlugins);

  const report = {
    generatedAt: new Date().toISOString(),
    detected,
    missing: { expo: missingExpo, npm: missingNpm },
    plugins: validPlugins, // ✅ ONLY valid config plugins
    pluginsAll: allPlugins,
    pluginsSkipped: skippedPlugins,
  };

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log("\n[K1W1] Native scan complete.");
  console.log(`[K1W1] Detected: ${detected.length}`);
  console.log(`[K1W1] Missing (expo): ${missingExpo.length}`);
  console.log(`[K1W1] Missing (npm): ${missingNpm.length}`);
  console.log(`[K1W1] Config-plugins valid: ${validPlugins.length}`);
  if (skippedPlugins.length) {
    console.log(`[K1W1] Skipped non-config-plugins: ${skippedPlugins.join(", ")}`);
  }
  console.log(`[K1W1] Report: ${REPORT_PATH}\n`);

  if (!apply) return;

  // Install missing deps
  if (missingExpo.length) {
    console.log("[K1W1] Installing expo deps:", missingExpo.join(", "));
    run("npx", ["-y", "expo", "install", ...missingExpo]);
  }
  if (missingNpm.length) {
    console.log("[K1W1] Installing npm deps:", missingNpm.join(", "));
    run("npm", ["install", ...missingNpm]);
  }

  console.log("\n[K1W1] Apply finished.\n");
}

main();
