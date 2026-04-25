// screens/DiagnosticScreen/styles.ts
// Extracted from DiagnosticScreen/index.tsx

import { StyleSheet } from "react-native";

import { coreStyles } from "./styles/coreStyles";
import { modalStyles } from "./styles/modalStyles";

export const styles = StyleSheet.create({
  ...coreStyles,
  ...modalStyles,
});

export type DiagnosticScreenStyles = typeof styles;
