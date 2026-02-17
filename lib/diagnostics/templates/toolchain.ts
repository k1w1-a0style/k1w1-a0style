// lib/diagnostics/templates/toolchain.ts

export type Toolchain = {
  expo: string;
  react: string;
  reactDom: string;
  reactNative: string;
  jestExpo: string;
};

export const DEFAULT_TOOLCHAIN: Toolchain = {
  expo: "~54.0.32",
  react: "19.1.0",
  reactDom: "19.1.0",
  reactNative: "0.81.5",
  jestExpo: "~54.0.16",
};
