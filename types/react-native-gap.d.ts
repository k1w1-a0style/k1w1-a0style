// types/react-native-gap.d.ts
// RN gap typings without shadowing the public "react-native" module.
// We augment the internal StyleSheetTypes module where FlexStyle is declared.

import "react-native/Libraries/StyleSheet/StyleSheetTypes";

declare module "react-native/Libraries/StyleSheet/StyleSheetTypes" {
  interface FlexStyle {
    /** React Native 0.71+ supports gap/rowGap/columnGap (varies by platform). */
    gap?: number;
    rowGap?: number;
    columnGap?: number;
  }
}

export {};
