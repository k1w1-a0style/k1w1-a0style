/**
 * app.config.js – Expo App Config (Android-only)
 * ✅ android.softwareKeyboardLayoutMode = "pan"
 * ✅ Supabase Env Support
 */

require("dotenv").config();

const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID;

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
      // ✅ Supabase Env
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || "",
      EXPO_PUBLIC_SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
    },
  },
};
