// components/CustomDrawer/styles.ts
// Extracted from CustomDrawer.tsx

import { StyleSheet } from "react-native";
import { theme } from "../../theme";

export const HAIRLINE = StyleSheet.hairlineWidth;

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.palette.background,
  },

  header: {
    paddingTop: 48,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${theme.palette.primary}18`,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  headerGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: `${theme.palette.primary}12`,
  },

  logoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.md,
    backgroundColor: `${theme.palette.primary}14`,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}24`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.sm,
  },
  logoText: {
    flex: 1,
  },
  appTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  appSubTitle: {
    marginTop: 2,
    fontSize: 11,
    color: theme.palette.text.secondary,
  },

  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: theme.palette.userBubble.background,
    borderRadius: theme.borderRadius.full,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}18`,
    alignSelf: "flex-start",
    gap: 8,
  },
  statusText: {
    fontSize: 11,
    color: theme.palette.text.secondary,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  statusSpacer: {
    width: 2,
  },

  chipRow: {
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "transparent",
    borderRadius: theme.borderRadius.full,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}1a`,
    overflow: "hidden",
  },
  chipGlow: {
    borderColor: `${theme.palette.primary}33`,
  },
  chipText: {
    flex: 1,
    fontSize: 11,
    color: theme.palette.text.secondary,
  },

  neonDivider: {
    height: 1,
    marginTop: theme.spacing.md,
    opacity: 0.95,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
    marginHorizontal: theme.spacing.md,
    gap: 8,
  },
  sectionIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}12`,
    backgroundColor: `${theme.palette.primary}0d`,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.palette.text.disabled,
    letterSpacing: 1.1,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    marginLeft: 8,
    backgroundColor: `${theme.palette.primary}10`,
  },

  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    marginHorizontal: theme.spacing.sm,
    marginVertical: 2,
    borderRadius: theme.borderRadius.lg,
    borderWidth: HAIRLINE,
    borderColor: theme.palette.border,
    backgroundColor: theme.palette.card,
    position: "relative",
    overflow: "hidden",
  },
  drawerItemActive: {
    backgroundColor: theme.palette.userBubble.background,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}24`,
  },
  drawerItemPressed: {
    backgroundColor: theme.palette.cardHover,
  },

  activeRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    opacity: 0.9,
  },

  pulseDot: {
    borderWidth: HAIRLINE,
    marginRight: 8,
  },

  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.palette.backgroundDark,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}18`,
    alignItems: "center",
    justifyContent: "center",
    marginRight: theme.spacing.sm,
  },
  iconContainerActive: {
    backgroundColor: `${theme.palette.primary}12`,
    borderColor: `${theme.palette.primary}35`,
  },

  drawerItemText: {
    fontSize: 14,
    color: theme.palette.text.primary,
    flex: 1,
  },
  drawerItemTextActive: {
    fontWeight: "700",
    color: theme.palette.text.primary,
  },

  badge: {
    backgroundColor: theme.palette.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#fff",
  },

  activeChevron: {
    marginLeft: 4,
    opacity: 0.9,
  },

  footer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.palette.border,
    backgroundColor: "transparent",
  },
  footerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  footerText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.palette.text.primary,
  },
  versionBadge: {
    backgroundColor: theme.palette.userBubble.background,
    borderWidth: HAIRLINE,
    borderColor: `${theme.palette.primary}18`,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  versionText: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.palette.text.secondary,
    fontFamily: "monospace",
  },
  footerSubtext: {
    fontSize: 10,
    color: theme.palette.text.disabled,
    marginTop: 4,
  },
});
