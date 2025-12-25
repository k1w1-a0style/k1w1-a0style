/**
 * app.config.js – Expo App Config (Android-only)
 * ✅ android.softwareKeyboardLayoutMode = "pan"
 * ✅ EAS projectId nur wenn ENV gesetzt ist (kein Dummy!)
 */

require("dotenv").config();

const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

const fs = require("fs");
const path = require("path");

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

const AUTOGEN = readAutogen();

module.exports = {
  expo: {
    jsEngine: "hermes",
    name: "k1w1-a0style",
    slug: "k1w1-a0style",
    version: "1.0.0",
    scheme: "k1w1a0",
    orientation: "portrait",
    userInterfaceStyle: "automatic",

    // ✅ Android-only
    platforms: ["android"],

    // ✅ Expo wollte das (wegen expo-font install/dev-client)
    plugins: uniqPlugins(["expo-font", ...(AUTOGEN.plugins || [])]),

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
