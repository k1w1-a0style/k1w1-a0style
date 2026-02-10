// Enable ViewStyle.gap/rowGap/columnGap typing for React Native.
// RN supports gap on newer versions, but TS types can lag behind.

import "react-native";

declare module "react-native" {
  interface ViewStyle {
    gap?: number;
    rowGap?: number;
    columnGap?: number;
  }
}
