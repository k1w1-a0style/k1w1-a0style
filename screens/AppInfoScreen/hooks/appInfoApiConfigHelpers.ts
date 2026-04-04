import type { AIConfig, AllAIProviders } from "../../../contexts/AIContext";
import { mergeApiConfigImportPreservingLocalKeys } from "../../../lib/appInfoBackup";

const PROVIDERS: AllAIProviders[] = ["groq", "gemini", "openai", "anthropic", "huggingface"];

export function applyImportedApiConfig(rawConfig: unknown, currentConfig: AIConfig): {
  nextConfig: AIConfig;
  totalKeysImported: number;
} {
  const nextConfig = mergeApiConfigImportPreservingLocalKeys(rawConfig, currentConfig);
  const totalKeysImported = PROVIDERS.reduce(
    (sum, provider) => sum + (nextConfig.apiKeys?.[provider]?.length || 0),
    0,
  );
  return { nextConfig, totalKeysImported };
}
