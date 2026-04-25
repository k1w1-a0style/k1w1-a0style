import { StyleSheet } from "react-native";

import type { AllAIProviders, ModelTier } from "../../contexts/AIContext";
import { keyManagementStyles } from "./styles/keyManagementStyles";
import { mainStyles } from "./styles/mainStyles";

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
  ...mainStyles,
  ...keyManagementStyles,
});
