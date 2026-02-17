import { normalizePath } from "../../validators";
import { DEFAULT_TOOLCHAIN } from "./toolchain";

export function minimalDefaultFor(path: string): string {
  switch (normalizePath(path)) {
    case "babel.config.js":
      return `module.exports = function(api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
`;
    case "metro.config.js":
      return `const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
module.exports = config;
`;
    case "tsconfig.json":
      return JSON.stringify(
        {
          extends: "expo/tsconfig.base",
          compilerOptions: {
            strict: true,
            noEmit: true,
          },
        },
        null,
        2,
      );
    case "index.js":
      return `import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
`;
    case "App.tsx":
      return `import React from 'react';
import { View, Text } from 'react-native';

export default function App(){
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>APK Builder - New Project</Text>
    </View>
  );
}
`;
    case "eas.json":
      return JSON.stringify(
        {
          cli: { appVersionSource: "remote" },
          build: {
            preview: { android: { buildType: "apk" } },
            production: { android: { buildType: "apk" } },
          },
        },
        null,
        2,
      );
    case "package.json":
      return JSON.stringify(
        {
          name: "app",
          version: "1.0.0",
          main: "index.js",
          scripts: {
            start: "expo start",
            android: "expo start --android",
            typecheck: "tsc --noEmit",
            "lint:ci": "eslint . --quiet",
            "test:silent": "jest --runInBand",
          },
          dependencies: {
            expo: DEFAULT_TOOLCHAIN.expo,
            react: DEFAULT_TOOLCHAIN.react,
            "react-native": DEFAULT_TOOLCHAIN.reactNative,
            "react-dom": DEFAULT_TOOLCHAIN.reactDom,
          },
          devDependencies: {
            "jest-expo": DEFAULT_TOOLCHAIN.jestExpo,
            typescript: "^5.8.0",
            "@types/react": "^19.0.0",
          },
        },
        null,
        2,
      );
    default:
      return "";
  }
}

export function minimalAppJson() {
  return {
    expo: {
      name: "My App",
      slug: "my-app",
      version: "1.0.0",
      platforms: ["android"],
      newArchEnabled: true,
      icon: "./assets/icon.png",
      splash: {
        image: "./assets/splash.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
      android: {
        package: "com.example.app",
        adaptiveIcon: {
          foregroundImage: "./assets/adaptive-icon.png",
          backgroundColor: "#ffffff",
        },
      },
      assetBundlePatterns: ["**/*"],
    },
  };
}

export function defaultEasIgnore(): string {
  return [
    ".git",
    "node_modules",
    "android",
    "ios",
    ".expo",
    ".cache",
    "dist",
    "build",
    ".DS_Store",
  ].join("\n") + "\n";
}
