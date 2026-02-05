import { StyleSheet } from "react-native";

import { theme } from "../../theme";
import type { AllAIProviders, ModelTier } from "../../contexts/AIContext";

export type ProviderId = AllAIProviders;

export const PROVIDER_IDS: AllAIProviders[] = [
  "groq",
  "gemini",
  "openai",
  "anthropic",
  "huggingface",
];

export const tierTokens: Record<
  ModelTier,
  { label: string; bg: string; color: string }
> = {
  free: { label: "Free", bg: "#0f9d580f", color: "#0f9d58" },
  credit: { label: "Quota", bg: "#1a73e80f", color: "#1a73e8" },
  paid: { label: "Paid", bg: "#ea43350f", color: "#ea4335" },
};

export const personaTokens = {
  speed: { label: "⚡ Speed", color: "#ff8c37" },
  quality: { label: "💎 Qualität", color: "#7c4dff" },
  balanced: { label: "⚖️ Balance", color: "#5e8bff" },
  review: { label: "🔍 Review", color: "#ff5c8d" },
};

// NOTE: UI styles extracted from the previous monolithic SettingsScreen.
// Keep names/values stable to avoid any UI/behavior changes.
export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.palette.background },
  container: { flex: 1, padding: 16 },

  h1: {
    fontSize: 24,
    fontWeight: "900",
    color: theme.palette.text.primary,
    marginBottom: 12,
  },
  h2: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.palette.text.primary,
    marginBottom: 12,
  },
  h3: {
    fontSize: 13,
    fontWeight: "900",
    color: theme.palette.text.secondary,
    marginTop: 10,
    marginBottom: 8,
  },

  card: {
    backgroundColor: theme.palette.card,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },

  providerTile: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: theme.palette.background,
  },
  providerTileActive: {
    borderColor: theme.palette.primary,
    shadowColor: theme.palette.primary,
    elevation: 3,
  },
  providerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  providerTitle: {
    fontWeight: "900",
    color: theme.palette.text.primary,
    fontSize: 14,
  },
  providerDesc: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
  providerFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  providerKeys: { color: theme.palette.text.secondary, fontSize: 12 },
  providerKeysStrong: { color: theme.palette.text.primary, fontWeight: "900" },

  statusLamp: {
    width: 10,
    height: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
  },
  statusLampOk: {
    backgroundColor: theme.palette.primary,
    borderColor: theme.palette.primary,
  },
  statusLampIdle: {
    backgroundColor: theme.palette.border,
    borderColor: theme.palette.border,
  },
  statusLampAlert: {
    backgroundColor: theme.palette.error,
    borderColor: theme.palette.error,
  },

  alertBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: theme.palette.error + "22",
  },
  alertBadgeText: {
    color: theme.palette.error,
    fontWeight: "900",
    fontSize: 11,
  },

  emptyText: { color: theme.palette.text.secondary, fontSize: 12 },

  modeList: { gap: 10 },
  modeTile: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    padding: 12,
    backgroundColor: theme.palette.background,
  },
  modeTileActive: { borderColor: theme.palette.primary },
  modeTileHighlight: { borderColor: "#7c4dff" },
  modeHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modeTitle: {
    fontWeight: "900",
    color: theme.palette.text.primary,
    fontSize: 13,
  },
  modeTitleActive: { color: theme.palette.primary },
  tierToken: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  tierTokenText: { fontWeight: "900", fontSize: 11 },
  modeDesc: { color: theme.palette.text.secondary, fontSize: 12, marginTop: 6 },
  modeFoot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
  },
  personaBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontWeight: "900",
    fontSize: 11,
  },
  bestFor: { color: theme.palette.text.secondary, fontSize: 12, flex: 1 },

  qualityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  qualityBtn: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  qualityBtnActive: { borderColor: theme.palette.primary },
  qualityBtnText: { fontWeight: "900", fontSize: 12 },
  qualityBtnTextActive: { color: theme.palette.primary },

  note: {
    marginTop: 10,
    color: theme.palette.text.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
  noteStrong: { color: theme.palette.text.primary, fontWeight: "900" },

  providerPickerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  providerChip: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.palette.background,
  },
  providerChipActive: { borderColor: theme.palette.primary },
  providerChipText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
    fontSize: 12,
  },
  providerChipTextActive: { color: theme.palette.primary },

  keyRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  keyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background,
  },
  keyAddBtn: {
    borderRadius: 16,
    backgroundColor: theme.palette.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  keyAddBtnText: { fontWeight: "900", color: "#000" },

  keyList: { marginTop: 12, gap: 10 },
  keyItem: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.palette.background,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  keyText: { flex: 1, color: theme.palette.text.primary, fontSize: 12 },
  keyActions: { flexDirection: "row", gap: 8 },
  keyActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.palette.card,
  },
  keyActionDanger: { borderColor: theme.palette.error + "55" },

  rotateBtn: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  rotateBtnText: { fontWeight: "900", color: "#000" },

  agentToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 12,
  },
  agentToggleLabel: {
    color: theme.palette.text.primary,
    fontWeight: "900",
    fontSize: 13,
  },
  agentTogglePills: { flexDirection: "row", gap: 8 },
  agentTogglePill: {
    borderWidth: 1,
    borderColor: theme.palette.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "transparent",
    minWidth: 64,
    alignItems: "center",
  },
  agentTogglePillActive: {
    borderColor: theme.palette.primary,
    backgroundColor: theme.palette.primary + "22",
  },
  agentTogglePillActiveOff: {
    borderColor: theme.palette.error,
    backgroundColor: theme.palette.error + "18",
  },
  agentTogglePillText: {
    color: theme.palette.text.secondary,
    fontWeight: "900",
  },
  agentTogglePillTextActive: { color: theme.palette.primary },
  agentTogglePillTextActiveOff: { color: theme.palette.error },
  agentToggleHint: {
    color: theme.palette.text.secondary,
    fontSize: 12,
    marginBottom: 6,
  },

  notifyBtn: {
    marginTop: 10,
    borderRadius: 16,
    backgroundColor: theme.palette.primary,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  notifyBtnText: { fontWeight: "900", color: "#000" },

  tokenPreview: {
    marginTop: 8,
    color: theme.palette.text.secondary,
    fontSize: 12,
  },
});
