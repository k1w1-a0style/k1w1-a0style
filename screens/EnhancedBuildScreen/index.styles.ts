import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.palette.background },
  scroll: { flex: 1 },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.border,
    backgroundColor: theme.palette.card,
  },
  headerText: { flex: 1 },
  title: {
    color: theme.palette.text.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    color: theme.palette.text.secondary,
    fontSize: 13,
  },
  section: {
    marginTop: 14,
    marginHorizontal: 16,
  },
  blockedCard: {
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.error,
    borderRadius: 16,
    padding: 14,
  },
  blockedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  blockedTitle: {
    flex: 1,
    color: theme.palette.error,
    fontSize: 15,
    fontWeight: "900",
  },
  blockedDetail: {
    marginTop: 8,
    color: theme.palette.text.secondary,
    fontSize: 13,
    lineHeight: 18,
  },
  blockedCta: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.palette.error,
  },
  blockedCtaText: {
    color: theme.palette.error,
    fontSize: 13,
    fontWeight: "800",
  },
});
