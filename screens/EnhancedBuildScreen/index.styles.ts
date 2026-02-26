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
});
