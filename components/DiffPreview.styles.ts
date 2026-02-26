import { StyleSheet } from "react-native";
import { theme } from "../theme";

export const styles = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  toolbar: {
    flexDirection: "row",
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
  },
  tbtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  tbtnOn: {
    borderColor: theme.palette.text.accent,
    backgroundColor: "rgba(0,255,170,0.08)",
  },
  tbtnText: {
    color: theme.palette.text.primary,
    fontWeight: "700",
    fontSize: 12,
  },
  diff: {
    maxHeight: 340,
    padding: 10,
    backgroundColor: theme.palette.background,
  },
  split: {
    flexDirection: "row",
    gap: 10,
    padding: 10,
    backgroundColor: theme.palette.background,
  },
  pane: {
    flex: 1,
    maxHeight: 340,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 10,
    padding: 8,
  },
  label: {
    color: theme.palette.text.muted,
    marginBottom: 6,
    fontWeight: "800",
  },
  mono: {
    color: theme.palette.text.primary,
    fontFamily: "monospace",
    fontSize: 12,
  },
  line: {
    fontFamily: "monospace",
    fontSize: 12,
    color: theme.palette.text.primary,
    marginBottom: 2,
  },
  add: { color: theme.palette.success },
  del: { color: theme.palette.error },
  same: { color: theme.palette.text.muted },
  fallback: { padding: 10, backgroundColor: theme.palette.background },
  note: { color: theme.palette.text.muted, marginBottom: 8 },
});
