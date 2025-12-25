/**
 * app.config.js – Expo App Config (Android-only)
 * ✅ android.softwareKeyboardLayoutMode = "pan"
 * ✅ EAS projectId nur wenn ENV gesetzt ist
 * ✅ Autogen Plugins (crash-sicher): nur echte Expo Config Plugins (app.plugin.*)
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

function readAutogen() {
  try {
    const p = path.join(__dirname, "scripts", ".k1w1-native-autogen.json");
    if (!fs.existsSync(p)) return { plugins: [] };
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { plugins: [] };
  }
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

function hasAppPluginFile(pkgName) {
  if (!pkgName || isLocalPluginRef(pkgName)) return true;

  try {
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
    const root = path.dirname(pkgJsonPath);
    const candidates = ["app.plugin.js", "app.plugin.cjs", "app.plugin.mjs"];
    return candidates.some((f) => fs.existsSync(path.join(root, f)));
  } catch {
    return false;
  }
}

function filterValidConfigPlugins(entries) {
  const valid = [];
  for (const entry of entries) {
    const name = getPluginName(entry);
    if (!name) continue;
    if (hasAppPluginFile(name)) valid.push(entry);
  }
  return valid;
}

const AUTOGEN = readAutogen();
const autogenPlugins = Array.isArray(AUTOGEN.plugins) ? AUTOGEN.plugins : [];

// Baseline (nur wenn wirklich Config Plugin vorhanden)
const baseline = filterValidConfigPlugins(["expo-font"]);

const finalPlugins = uniqPlugins([...baseline, ...autogenPlugins]);

module.exports = {
  expo: {
    jsEngine: "hermes",
    name: "k1w1-a0style",
    slug: "k1w1-a0style",
    version: "1.0.0",
    scheme: "k1w1a0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",
    platforms: ["android"],

    plugins: finalPlugins,

    assetBundlePatterns: ["**/*"],

    android: {
      package: "com.k1w1.a0style",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#FFFFFF",
      },
      softwareKeyboardLayoutMode: "pan",
    },

    extra: {
      eas: {
        ...(EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : {}),
      },
    },
  },
};
