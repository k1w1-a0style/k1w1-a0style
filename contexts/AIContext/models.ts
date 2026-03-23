// contexts/AIContext/models.ts
// Extracted from AIContext.tsx: types, model catalog, provider metadata.

export type AllAIProviders = 'groq' | 'gemini' | 'openai' | 'anthropic' | 'huggingface';
export type QualityMode = 'speed' | 'balanced' | 'quality' | 'review';
export type ModelTier = 'free' | 'credit' | 'paid';
export type ProviderLimitStatus = { provider: AllAIProviders; status: 'ok' | 'missing_key' | 'rate_limited'; message?: string };

export type ModelInfo = {
  id: string;
  label: string;
  description: string;
  tier: ModelTier;
  persona: QualityMode;
  bestFor: string;
  contextWindow?: string;
  pricePerMillion?: string;
  availabilityLabel?: string;
  codingStrength?: number;
  isAuto?: boolean;
};

export type ProviderDefaults = {
  speed: string;
  quality: string;
};

export type ProviderMetadata = {
  id: AllAIProviders;
  label: string;
  emoji: string;
  description: string;
  hero: string;
  accent: string;
  freeHint?: string;
  docsUrl: string;
};

export type AIConfig = {
  version: number;
  selectedChatProvider: AllAIProviders;
  selectedChatMode: string;
  selectedAgentProvider: AllAIProviders;
  selectedAgentMode: string;
  qualityMode: QualityMode;

  agentEnabled: boolean;

  apiKeys: Record<AllAIProviders, string[]>;
};

export type AIContextProps = {
  config: AIConfig;
  setConfig: (next: AIConfig) => void;
  updateConfig: (patch: Partial<AIConfig>) => void;

  addApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  removeApiKey: (provider: AllAIProviders, key: string) => Promise<void>;
  clearApiKeys: (provider: AllAIProviders) => Promise<void>;

  setSelectedChatProvider: (provider: AllAIProviders) => void;
  setSelectedAgentProvider: (provider: AllAIProviders) => void;
  setSelectedChatMode: (mode: string) => void;
  setSelectedAgentMode: (mode: string) => void;
  setQualityMode: (mode: QualityMode) => void;

  setAgentEnabled: (enabled: boolean) => void;

  rotateApiKey: (provider: AllAIProviders) => Promise<void>;
  moveApiKeyToFront: (provider: AllAIProviders, keyOrIndex: string | number) => Promise<void>;

  providerStatus: ProviderLimitStatus[];
  acknowledgeProviderStatus: (provider: AllAIProviders) => void;
};

const model = (entry: ModelInfo): ModelInfo => entry;

export const PROVIDER_DEFAULTS: Record<AllAIProviders, ProviderDefaults> = {
  groq: { speed: 'groq/compound-mini', quality: 'llama-3.3-70b-versatile' },
  openai: { speed: 'gpt-4o-mini', quality: 'gpt-4o' },
  anthropic: { speed: 'claude-3-5-haiku-20241022', quality: 'claude-3-5-sonnet-20241022' },
  gemini: { speed: 'gemini-2.5-flash-lite', quality: 'gemini-2.5-flash' },
  huggingface: { speed: 'Qwen/Qwen2.5-7B-Instruct', quality: 'Qwen/Qwen2.5-Coder-32B-Instruct' },
};

export const PROVIDER_METADATA: Record<AllAIProviders, ProviderMetadata> = {
  groq: {
    id: 'groq',
    label: 'Groq',
    emoji: '⚡',
    description: 'Ultraschnelle FPGA-Inference über OpenAI-kompatible API.',
    hero: 'Speed Demon',
    accent: '#22c55e',
    freeHint: 'Sehr schnell im Free-/Low-Cost-Bereich.',
    docsUrl: 'https://console.groq.com/docs',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    emoji: '🧠',
    description: 'Starke Allround-Modelle, bestes Ökosystem.',
    hero: 'Allround Brain',
    accent: '#60a5fa',
    docsUrl: 'https://platform.openai.com/docs',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    emoji: '🧩',
    description: 'Sehr starkes Reasoning + Textqualität.',
    hero: 'Reasoning Pro',
    accent: '#f59e0b',
    docsUrl: 'https://docs.anthropic.com',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    emoji: '✨',
    description: 'Google Gemini – schnell + stabil mit großem Kontextfenster.',
    hero: 'Context King',
    accent: '#a78bfa',
    docsUrl: 'https://ai.google.dev',
  },
  huggingface: {
    id: 'huggingface',
    label: 'Hugging Face',
    emoji: '🤗',
    description: 'HF Router / open-source models.',
    hero: 'Open Model Zoo',
    accent: '#fb7185',
    docsUrl: 'https://huggingface.co/docs/api-inference/index',
  },
};

export const AVAILABLE_MODELS: Record<AllAIProviders, ModelInfo[]> = {
  anthropic: [
    model({ id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', description: 'Schnell und solide für einfache Antworten.', tier: 'credit', persona: 'speed', bestFor: 'Speed', contextWindow: '200k', pricePerMillion: '$0.25 / $1.25', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
    model({ id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', description: 'Schneller Daily Driver mit guter Code-Qualität.', tier: 'credit', persona: 'speed', bestFor: 'Speed + Qualität', contextWindow: '200k', pricePerMillion: '$0.80 / $4', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
    model({ id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', description: 'Bewährtes Qualitätsmodell für Review, Refactor und Diagnose.', tier: 'credit', persona: 'quality', bestFor: 'Quality/Review', contextWindow: '200k', pricePerMillion: '$3 / $15', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', description: 'Aktuellere Sonnet-Generation für Coding und Reasoning.', tier: 'credit', persona: 'quality', bestFor: 'Code + Reasoning', contextWindow: '200k', pricePerMillion: '$3 / $15', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
  ],
  openai: [
    model({ id: 'gpt-4o', label: 'GPT-4o', description: 'Starker Allrounder für Coding, Diagnose und Chat.', tier: 'credit', persona: 'quality', bestFor: 'Allround', contextWindow: '128k', pricePerMillion: '$5 / $15', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'gpt-4o-mini', label: 'GPT-4o mini', description: 'Schnell und günstig für tägliche Chat-/Fix-Aufgaben.', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: '128k', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
    model({ id: 'gpt-4.1', label: 'GPT-4.1', description: 'Stark für Code und Reasoning, wenn 4o nicht reicht.', tier: 'credit', persona: 'quality', bestFor: 'Code', contextWindow: '128k', pricePerMillion: '$8 / $24', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', description: 'Gute Preis/Leistung für strukturierte Antworten.', tier: 'credit', persona: 'balanced', bestFor: 'Daily', contextWindow: '128k', pricePerMillion: '$2 / $8', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
  ],
  gemini: [
    model({ id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', description: 'Sehr schnell und günstig für Daily-Checks.', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: '1M', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Runtime OK', codingStrength: 2 }),
    model({ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Bewährter Daily Driver mit großem Kontext.', tier: 'credit', persona: 'balanced', bestFor: 'Daily', contextWindow: '1M', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
    model({ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Mehr Qualität für schwierigere Aufgaben und Langkontext.', tier: 'paid', persona: 'quality', bestFor: 'Review/Analyse', contextWindow: '2M', pricePerMillion: '$7 / $25', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
  ],
  groq: [
    model({ id: 'groq/compound-mini', label: 'Compound Mini', description: 'Sehr schnell und günstig für kurze Chat-/UI-Aufgaben.', tier: 'free', persona: 'speed', bestFor: 'Chat / UI Text', contextWindow: 'varies', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Runtime OK', codingStrength: 2 }),
    model({ id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', description: 'Schnell und stabil für kurze Aufgaben.', tier: 'free', persona: 'speed', bestFor: 'Alltag', contextWindow: '128k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Runtime OK', codingStrength: 2 }),
    model({ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', description: 'Mehr Qualität für komplexere Prompts.', tier: 'paid', persona: 'quality', bestFor: 'Qualität', contextWindow: '128k', pricePerMillion: '$2 / $8', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'qwen/qwen3-32b', label: 'Qwen 3 32B', description: 'Stark für Code/Logik, manchmal mit Thinking-Output.', tier: 'credit', persona: 'balanced', bestFor: 'Code / Reasoning', contextWindow: '128k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
  ],
  huggingface: [
    model({ id: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen2.5 Coder 32B', description: 'Stark für Code und Refactors über den HF Router.', tier: 'free', persona: 'quality', bestFor: 'Code', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5 7B', description: 'Schnell für Chat und kleine Hilfstasks.', tier: 'free', persona: 'speed', bestFor: 'Chat', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
    model({ id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B Instruct', description: 'OSS-Chat-Modell mit leichtem Footprint.', tier: 'free', persona: 'speed', bestFor: 'Chat', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
    model({ id: 'google/gemma-2-9b-it', label: 'Gemma 2 9B', description: 'Kurzantworten und Assistenz-Aufgaben.', tier: 'free', persona: 'speed', bestFor: 'Kurzantworten', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
  ],
};
