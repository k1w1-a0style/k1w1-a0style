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
    // ✅ Test expects "fpga"
    description: 'Ultraschnelle FPGA-Inference über OpenAI-kompatible API.',
    hero: 'Speed Demon',
    accent: '#22c55e',
    freeHint: 'Sehr günstig / oft “free-tier friendly”.',
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
    description: 'Google Gemini – schnell + stabil.',
    hero: 'Context King',
    accent: '#a78bfa',
    docsUrl: 'https://ai.google.dev',
  },
  huggingface: {
    id: 'huggingface',
    label: 'Hugging Face',
    emoji: '🤗',
    // ✅ Test expects "open-source"
    description: 'HF Router / open-source models.',
    hero: 'Open Model Zoo',
    accent: '#fb7185',
    docsUrl: 'https://huggingface.co/docs/api-inference/index',
  },
};

export const AVAILABLE_MODELS: Record<AllAIProviders, ModelInfo[]> = {
  groq: [
    { id: 'groq/compound-mini', label: 'Compound Mini', description: 'Sehr schnell & günstig.', tier: 'free', persona: 'speed', bestFor: 'Chat / UI Text', contextWindow: 'varies' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', description: 'Schnell, stabil.', tier: 'free', persona: 'speed', bestFor: 'Alltag'},
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile', description: 'Mehr Qualität für komplexere Prompts.', tier: 'paid', persona: 'quality', bestFor: 'Qualität'},
    { id: 'qwen/qwen3-32b', label: 'Qwen 3 32B', description: 'Sehr gut für Code/Logik (manchmal mit <think>).', tier: 'credit', persona: 'balanced', bestFor: 'Code / Reasoning'},
    { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B (Groq)', description: 'OpenAI OSS Modell über Groq.', tier: 'free', persona: 'balanced', bestFor: 'Reasoning/Chat'},
    { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B (Groq)', description: 'Großes OSS Modell über Groq.', tier: 'credit', persona: 'quality', bestFor: 'Qualität'},
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o', description: 'Starker Allrounder.', tier: 'credit', persona: 'quality', bestFor: 'Allround', contextWindow: '128k' },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', description: 'Schnell & günstig.', tier: 'free', persona: 'speed', bestFor: 'Speed'},
    { id: 'gpt-4.1', label: 'GPT-4.1', description: 'Sehr gut für Code/Reasoning.', tier: 'credit', persona: 'quality', bestFor: 'Code'},
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', description: 'Top Preis/Leistung.', tier: 'credit', persona: 'speed', bestFor: 'Daily'},
    { id: 'gpt-4.1-nano', label: 'GPT-4.1 nano', description: 'Extrem schnell.', tier: 'free', persona: 'speed', bestFor: 'Mini-Tasks'},
  ],
  anthropic: [
    { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', description: 'Schnell, solide.', tier: 'credit', persona: 'speed', bestFor: 'Speed'},
    { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', description: 'Schnell + besser.', tier: 'credit', persona: 'speed', bestFor: 'Speed+Qualität'},
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', description: 'Höhere Qualität (Reasoning/Writing).', tier: 'credit', persona: 'quality', bestFor: 'Quality/Review', contextWindow: '200k' },
  ],
  gemini: [
    // ✅ Test wants at least one model with "1M" or "2M"
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite', description: 'Sehr schnell & günstig.', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: '1M' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Daily Driver.', tier: 'credit', persona: 'balanced', bestFor: 'Daily', contextWindow: '1M' },
  ],
  huggingface: [
    { id: 'Qwen/Qwen2.5-Coder-32B-Instruct', label: 'Qwen2.5 Coder 32B', description: 'Stark für Code.', tier: 'free', persona: 'quality', bestFor: 'Code', contextWindow: 'varies' },
    { id: 'Qwen/Qwen2.5-7B-Instruct', label: 'Qwen2.5 7B', description: 'Schnell für Chat.', tier: 'free', persona: 'speed', bestFor: 'Chat'},
    { id: 'meta-llama/Llama-3.1-8B-Instruct', label: 'Llama 3.1 8B Instruct', description: 'OSS Chat.', tier: 'free', persona: 'speed', bestFor: 'Chat'},
    { id: 'google/gemma-2-9b-it', label: 'Gemma 2 9B', description: 'Kurzantworten / Hilfe.', tier: 'free', persona: 'speed', bestFor: 'Kurzantworten'},
  ],
};
