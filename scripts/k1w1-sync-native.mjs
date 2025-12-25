#!/usr/bin/env node
/**
 * K1W1 Native Sync – scan project files for native-ish deps and ensure they're installed.
 * Writes autogen report: scripts/.k1w1-native-autogen.json
 *
 * Flags:
 *   --apply       installs missing deps + auto-rescan + expo config check
 *   --apply=true  same
 *   --apply=false report only (NOW includes expo config check too)
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

function writeJSON(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function walk(dir, out = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      if (
        it.name === "node_modules" ||
        it.name === ".git" ||
        it.name === "android" ||
        it.name === "ios"
      )
        continue;
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

function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false,
    cwd: PROJECT_ROOT,
  });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed (${res.status})`);
  }
}

function runCapture(cmd, args) {
  return spawnSync(cmd, args, {
    cwd: PROJECT_ROOT,
    shell: false,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}

function clip(s, max = 2500) {
  const str = String(s ?? "");
  if (str.length <= max) return str;
  return str.slice(0, max) + "\n...<clipped>...";
}

function guessExpoConfigTip(stderrText) {
  const s = String(stderrText || "");

  if (/Cannot find module 'dotenv'|Cannot find module "dotenv"/i.test(s)) {
    return `Tipp: Installiere dotenv (dev oder normal) und stelle sicher, dass app.config.js require("dotenv").config() laden kann.\nCommand: npm i -D dotenv`;
  }

  if (/does not contain a valid config plugin/i.test(s)) {
    return `Tipp: Du hast ein Plugin in "plugins" stehen, das KEIN Expo Config Plugin ist (kein app.plugin.*).\nFix: Entferne es aus plugins oder lass es nur in der Autogen-Liste als "non-config-plugin" drin (nicht in app.config.js plugins).`;
  }

  if (/Unexpected token 'typeof'/i.test(s)) {
    return `Tipp: Meist Folgefehler durch kaputtes Plugin/Config-Laden.\nCheck: In stderr steht oft vorher "valid config plugin" Fehler oder ein require()-Problem.`;
  }

  if (/Error reading Expo config/i.test(s)) {
    return `Tipp: app.config.js wirft beim Ausführen einen Fehler. Schau auf die erste Root-Cause in stderr (Missing module / SyntaxError / require stack).`;
  }

  if (/fetch failed|Unable to reach/i.test(s)) {
    return `Tipp: Das ist meist ein Expo-API/Netzwerk-Thema (expo-doctor). expo config selbst sollte offline gehen.\nWenn expo config check fehlschlägt: prüfe Node/CLI Output.`;
  }

  return "Tipp: Sieh dir stderrHead an (Root Cause). Häufig: kaputtes app.config.js, ungültige Plugins, fehlende Module.";
}

function parseApplyFlag() {
  const arg = process.argv.find((x) => x.startsWith("--apply"));
  if (!arg) return false;
  const parts = arg.split("=");
  if (parts.length === 1) return true;
  return parts[1].trim().toLowerCase() === "true";
}

function scanOnce() {
  if (!fs.existsSync(MAP_PATH)) {
    console.error("Missing map file:", MAP_PATH);
    process.exit(1);
  }

  const MAP = readJSON(MAP_PATH);
  const files = walk(PROJECT_ROOT);

  const detected = [];

  for (const [pkgName, cfg] of Object.entries(MAP)) {
    const token = pkgName.replace("/", "\\/");
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

  const allPlugins = uniqPlugins(detected.flatMap((d) => d.plugins || []));
  const { valid: validPlugins, skipped: skippedPlugins } = filterValidConfigPlugins(allPlugins);

  const report = {
    generatedAt: new Date().toISOString(),
    detected,
    missing: { expo: missingExpo, npm: missingNpm },
    plugins: validPlugins,
    pluginsAll: allPlugins,
    pluginsSkipped: skippedPlugins,
    expoConfigCheck: null, // will be filled by checkExpoConfigAndPatchReport()
  };

  writeJSON(REPORT_PATH, report);

  return { report, missingExpo, missingNpm, validPlugins, skippedPlugins, detected };
}

function printSummary({ detected, missingExpo, missingNpm, validPlugins, skippedPlugins }) {
  console.log("\n[K1W1] Native scan complete.");
  console.log(`[K1W1] Detected: ${detected.length}`);
  console.log(`[K1W1] Missing (expo): ${missingExpo.length}`);
  console.log(`[K1W1] Missing (npm): ${missingNpm.length}`);
  console.log(`[K1W1] Config-plugins valid: ${validPlugins.length}`);
  if (skippedPlugins.length) {
    console.log(`[K1W1] Skipped non-config-plugins: ${skippedPlugins.join(", ")}`);
  }
  console.log(`[K1W1] Report: ${REPORT_PATH}\n`);
}

function checkExpoConfigAndPatchReport() {
  console.log("[K1W1] Checking Expo config (npx -y expo config --type public) ...");

  const res = runCapture("npx", ["-y", "expo", "config", "--type", "public"]);
  const stdoutHead = clip(res.stdout, 2200);
  const stderrHead = clip(res.stderr, 2200);

  const ok = res.status === 0 && !res.error;
  const tip = ok ? "OK" : guessExpoConfigTip(res.stderr);

  const payload = {
    checkedAt: new Date().toISOString(),
    ok,
    exitCode: res.status,
    error: res.error ? String(res.error?.message || res.error) : null,
    stdoutHead,
    stderrHead,
    tip,
  };

  // Patch report file
  let report = null;
  try {
    report = readJSON(REPORT_PATH);
  } catch {
    report = {};
  }

  report.expoConfigCheck = payload;
  writeJSON(REPORT_PATH, report);

  if (ok) {
    console.log("[K1W1] Expo config check: OK ✅");
  } else {
    console.log("[K1W1] Expo config check: FAILED ❌");
    console.log("[K1W1] Tip:", tip);
  }

  return payload;
}

function main() {
  const apply = parseApplyFlag();

  // 1) Initial scan + report
  const first = scanOnce();
  printSummary(first);

  // ✅ NEW: Always run expo config sanity check, even in report-only mode
  checkExpoConfigAndPatchReport();

  // Report-only mode ends here
  if (!apply) return;

  // 2) Apply installs (based on FIRST scan)
  if (first.missingExpo.length) {
    console.log("[K1W1] Installing expo deps:", first.missingExpo.join(", "));
    run("npx", ["-y", "expo", "install", ...first.missingExpo]);
  }

  if (first.missingNpm.length) {
    console.log("[K1W1] Installing npm deps:", first.missingNpm.join(", "));
    run("npm", ["install", ...first.missingNpm]);
  }

  console.log("\n[K1W1] Apply finished. Re-scanning to refresh report...\n");

  // 3) Auto-rescan + final report
  const second = scanOnce();
  printSummary(second);

  // 4) Expo config sanity check again (after apply), so report reflects final state
  checkExpoConfigAndPatchReport();

  console.log("[K1W1] Final report refreshed after apply (includes expoConfigCheck).\n");
}

main();
