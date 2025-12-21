// styles/chatLoadingStyles.ts
import { StyleSheet } from "react-native";
import { theme } from "../theme";

export const styles = StyleSheet.create({
  loadingOverlay: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingOverlayText: { marginTop: 12, color: theme.palette.text.secondary },

  loadingFooter: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: theme.palette.card,
    borderRadius: 12,
    marginVertical: 8,
    gap: 8,
  },
  loadingText: { color: theme.palette.text.secondary, fontWeight: "600" },
  streamingText: {
    marginTop: 6,
    color: theme.palette.text.primary,
    fontSize: 14,
    lineHeight: 20,
  },

  thinkingDots: { flexDirection: "row", gap: 4, marginLeft: 4, marginTop: 2 },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.palette.primary,
  },
});
