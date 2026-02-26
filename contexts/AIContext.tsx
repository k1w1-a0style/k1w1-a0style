// contexts/AIContext.tsx
// REFACTORED → see ./AIContext/ folder
export {
  AIProvider,
  useAI,
  PROVIDER_DEFAULTS,
  PROVIDER_METADATA,
  AVAILABLE_MODELS,
} from "./AIContext/index";
export type {
  AllAIProviders,
  QualityMode,
  ModelTier,
  ProviderLimitStatus,
  ModelInfo,
  ProviderDefaults,
  ProviderMetadata,
  AIConfig,
  AIContextProps,
} from "./AIContext/index";
