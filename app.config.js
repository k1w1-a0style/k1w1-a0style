/* global __dirname */
/**
 * app.config.js – Expo App Config (Android-only)
 *
 * WICHTIG:
 * - expo.extra.eas.projectId MUSS deterministisch sein (CI + EAS Cloud Build).
 * - Deshalb wird projectId primär aus ./eas-project.json gelesen.
 * - ENV bleibt als Override erlaubt.
 */
try {
  require("dotenv").config();
} catch (e) {
  // dotenv is optional in CI; config must not crash if it is missing
}

const fs = require("fs");
const path = require("path");

function readEasProjectIdFromFile() {
  // Prefer __dirname so this works even if Expo CLI evaluates config with a different cwd.
  const candidates = [
    path.join(__dirname, "eas-project.json"),
    path.join(process.cwd(), "eas-project.json"),
  ];

  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      const json = JSON.parse(raw);
      const id = typeof (json && json.projectId) === "string" ? json.projectId.trim() : "";
      if (id) return id;
    } catch {
      // ignore and try next
    }
  }
  return "";
}

const EAS_PROJECT_ID =
  String(process.env.EAS_PROJECT_ID || "").trim() || readEasProjectIdFromFile();

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
    plugins: ["expo-font"],
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

      // Supabase (public)
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
    },
  },
};
