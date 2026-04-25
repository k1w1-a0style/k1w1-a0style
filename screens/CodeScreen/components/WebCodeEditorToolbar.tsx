import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import theme from "../../../theme";

type Props = {
  readyUi: boolean;
  onRunCmd: (cmd: "undo" | "redo") => void;
};

export function WebCodeEditorToolbar({ readyUi, onRunCmd }: Props) {
  return (
    <View style={[styles.toolbar, { borderBottomColor: theme.palette.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Undo"
        accessibilityHint="Macht die letzte Änderung rückgängig"
        disabled={!readyUi}
        onPress={() => onRunCmd("undo")}
        style={({ pressed }) => [styles.toolBtn, pressed && styles.toolBtnPressed, !readyUi && styles.toolBtnDisabled]}
      >
        <Text style={[styles.toolText, { color: theme.palette.text.secondary }]}>↶</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Redo"
        accessibilityHint="Stellt die zuletzt rückgängig gemachte Änderung wieder her"
        disabled={!readyUi}
        onPress={() => onRunCmd("redo")}
        style={({ pressed }) => [styles.toolBtn, pressed && styles.toolBtnPressed, !readyUi && styles.toolBtnDisabled]}
      >
        <Text style={[styles.toolText, { color: theme.palette.text.secondary }]}>↷</Text>
      </Pressable>
      {!readyUi ? <Text style={[styles.readyText, { color: theme.palette.text.secondary }]}>Editor…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    height: 34,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
  },
  toolBtn: {
    height: 26,
    minWidth: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  toolBtnPressed: {
    opacity: 0.75,
  },
  toolBtnDisabled: {
    opacity: 0.4,
  },
  toolText: {
    fontSize: 16,
    fontWeight: "600",
  },
  readyText: {
    marginLeft: 6,
    fontSize: 12,
  },
});
