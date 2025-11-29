// app.config.js
module.exports = {
  expo: {
    name: "K1W1 AO-Style",
    slug: "k1w1-a0style",
    owner: "k1w1-pro-plus",
    version: "1.0.0",
    icon: "./assets/icon.png",
    userInterfaceStyle: "dark",
    splash: {
      image: "./assets/icon.png",
      resizeMode: "contain",
      backgroundColor: "#121212"
    },
    android: {
      package: "com.k1w1.a0style",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#000000"
      },
      softwareKeyboardLayoutMode: "resize"
    },
    updates: {
      enabled: false
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      // NEU: Berechtigung für iOS Foto-Bibliothek
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Die App benötigt Zugriff auf deine Fotos, um ein neues App-Icon auszuwählen."
      }
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      eas: {
        projectId: "5e5a7791-8751-416b-9a1f-831adfffcb6c"
      }
    },
    plugins: [
      "expo-font",
      "expo-secure-store",
      // NEU: Plugin für Image Picker
      "expo-image-picker"
    ]
  }
};
