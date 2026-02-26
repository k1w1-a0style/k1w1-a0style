// screens/ConnectionsScreen/components/StatusCard.styles.ts
// Extracted from StatusCard.tsx
import { StyleSheet } from "react-native";
import { theme } from "../../../theme";

export const s = StyleSheet.create({
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  cardTitle: {
    color: theme.palette.text.primary,
    fontSize: 15,
    fontWeight: "800",
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.palette.borderLight,
  },

  lightRow: {
    width: 18,
    alignItems: "center",
    paddingTop: 2,
  },
  light: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: theme.palette.border,
  },
  lightOn: {
    backgroundColor: theme.palette.success,
    shadowColor: theme.palette.success,
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  lightLabel: {
    marginTop: 4,
    fontSize: 11,
    color: theme.palette.text.muted,
  },
  lightLabelOk: {
    color: theme.palette.success,
  },

  statusTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  statusLabel: {
    color: theme.palette.text.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  accountName: {
    marginTop: 2,
    color: theme.palette.text.secondary,
    fontSize: 12,
    fontWeight: "700",
  },

  detailNodeWrap: {
    marginTop: 6,
  },
  detailLineLabel: {
    color: theme.palette.text.muted,
    fontSize: 11,
    fontWeight: "700",
    marginRight: 6,
  },
  detailLine: {
    marginTop: 6,
    color: theme.palette.text.muted,
    fontSize: 11,
  },

  scopesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  scopesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },

  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeNeutral: {
    backgroundColor: theme.palette.cardHover,
    borderColor: theme.palette.border,
  },
  badgeNeutralText: {
    color: theme.palette.text.secondary,
  },
  badgeWarn: {
    backgroundColor: theme.palette.warning + "22",
    borderColor: theme.palette.warning,
  },
  badgeWarnText: {
    color: theme.palette.warning,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: "800",
  },

  missingRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  missingText: {
    color: theme.palette.warning,
    fontSize: 11,
    fontWeight: "700",
  },

  statusValue: {
    color: theme.palette.text.primary,
    fontSize: 12,
    fontWeight: "800",
    maxWidth: 150,
  },

  statusBadge: {
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  badgeOk: {
    backgroundColor: theme.palette.success + "22",
    color: theme.palette.success,
  },
  badgeFail: {
    backgroundColor: theme.palette.error + "22",
    color: theme.palette.error,
  },
});
