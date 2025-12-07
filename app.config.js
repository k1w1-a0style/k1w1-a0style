module.exports = {
  expo: {
    name: "K1W1 AO-Style",
    slug: "k1w1-a0style",
    owner: "a0style",
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

    ios: {
      supportsTablet: true,
      infoPlist: {
        NSPhotoLibraryUsageDescription:
          "Die App benötigt Zugriff auf deine Fotos, um ein neues App-Icon auszuwählen."
      }
    },

    web: {
      favicon: "./assets/favicon.png"
    },

    updates: {
      url: "https://u.expo.dev/dc9e8a5c-714d-4ae8-9ca9-98071a755655"
    },

    runtimeVersion: {
      policy: "appVersion"
    },

    assetBundlePatterns: ["**/*"],

    extra: {
      eas: {
        projectId: "dc9e8a5c-714d-4ae8-9ca9-98071a755655"
      }
    },

    plugins: [
      "expo-font",
      "expo-secure-store",
      "expo-image-picker"
    ],

    jsEngine: "hermes"
  }
};
