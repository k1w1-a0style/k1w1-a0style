module.exports = {
  expo: {
    name: "K1W1 AO-Style",
    slug: "k1w1-a0style",
    owner: "k1w1-pro-plus",
    version: "1.0.0",
    icon: "./assets/icon.png", // Pfad bestätigt
    userInterfaceStyle: "dark", // Erzwinge Dark Mode
    splash: {
      image: "./assets/icon.png", // Verwende App-Icon als Splash (korrigiert)
      resizeMode: "contain",
      backgroundColor: "#121212" // Dunkler Hintergrund
    },
    android: {
      package: "com.k1w1.a0style",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png", // Pfad bestätigt
        backgroundColor: "#000000" // Hintergrund für Adaptive Icon
      },
      softwareKeyboardLayoutMode: "resize"
    },
    updates: {
      enabled: false // Behalte deine Einstellung bei
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true
    },
    web: {
      favicon: "./assets/favicon.png" // Standardpfad
    },
    extra: {
      eas: {
        projectId: "5e5a7791-8751-416b-9a1f-831adfffcb6c" // Behalte deine Projekt-ID bei
      }
    },
    plugins: [
      "expo-font" // Plugin bleibt drin
    ]
  }
};
