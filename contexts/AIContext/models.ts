// contexts/AIContext/models.ts
// Extracted from AIContext.tsx: types, model catalog, provider metadata.

import { SHARED_PROVIDER_DEFAULTS } from '../../shared/ai/providerDefaults';

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

export const PROVIDER_DEFAULTS: Record<AllAIProviders, ProviderDefaults> = SHARED_PROVIDER_DEFAULTS;

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
    model({ id: 'claude-4-opus-202502', label: 'Opus 4.6', description: 'Beste Reasoning, Architektur, lange Refactors, Tests', tier: 'paid', persona: 'quality', bestFor: 'Quality/Review', contextWindow: '200k', pricePerMillion: '$15 / $75', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'claude-4-sonnet-202502', label: 'Sonnet 4.6', description: 'Sauberer Code, Multi-File, Tests, sehr zuverlässig', tier: 'credit', persona: 'quality', bestFor: 'Code + Reasoning', contextWindow: '200k', pricePerMillion: '$3 / $15', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'claude-4-haiku-202502', label: 'Haiku 4.5', description: 'Schnell, kleine Fixes, Syntax, Boilerplate', tier: 'credit', persona: 'speed', bestFor: 'Speed', contextWindow: '200k', pricePerMillion: '$0.30 / $1.50', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'claude-3.5-sonnet-202410', label: 'Sonnet 3.5', description: 'Stabil, gutes Preis-Leistungs-Verhältnis', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: '200k', pricePerMillion: '$3 / $15', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'claude-3.5-haiku-202410', label: 'Haiku 3.5', description: 'Sehr günstig & schnell', tier: 'credit', persona: 'speed', bestFor: 'Speed', contextWindow: '200k', pricePerMillion: '$0.30 / $1.50', availabilityLabel: 'Ja', codingStrength: 3 }),
  ],
  openai: [
    model({ id: 'gpt-5.5-codex', label: 'GPT-5.5 Codex', description: 'Agentic Coding, Tool-Use, komplexe Features', tier: 'paid', persona: 'quality', bestFor: 'Code + Review', contextWindow: '128k', pricePerMillion: '$20 / $60', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'gpt-5.4-pro', label: 'GPT-5.4 Pro', description: 'Große Repos, Architektur, Refactoring', tier: 'paid', persona: 'quality', bestFor: 'Quality/Review', contextWindow: '128k', pricePerMillion: '$15 / $45', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'gpt-5.4', label: 'GPT-5.4', description: 'Solides Reasoning, Multi-File', tier: 'credit', persona: 'balanced', bestFor: 'Allround', contextWindow: '128k', pricePerMillion: '$10 / $30', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', description: 'Schnell, Tests, Boilerplate', tier: 'credit', persona: 'speed', bestFor: 'Speed', contextWindow: '128k', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', description: 'Sehr leicht, Inline-Fixes', tier: 'free', persona: 'speed', bestFor: 'Mini-Tasks', contextWindow: '128k', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 2 }),
    model({ id: 'gpt-4o', label: 'GPT-4o', description: 'Klassiker, ausgewogene Qualität', tier: 'credit', persona: 'balanced', bestFor: 'Fallback/Allround', contextWindow: '128k', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 4 }),
  ],
  gemini: [
    model({ id: 'gemini-3.1-pro', label: '3.1 Pro', description: 'Beste Repo- & Kontext-Verständnis', tier: 'paid', persona: 'quality', bestFor: 'Quality/Review', contextWindow: '2M', pricePerMillion: '$10 / $35', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'gemini-2.5-pro', label: '2.5 Pro', description: 'Starkes Reasoning, sauberer Code', tier: 'paid', persona: 'quality', bestFor: 'Analyse', contextWindow: '2M', pricePerMillion: '$7 / $25', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'gemini-3-flash', label: '3 Flash', description: 'Sehr schnell, gute Syntax', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: '1M', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'gemini-2.5-flash', label: '2.5 Flash', description: 'Schnell & zuverlässig', tier: 'credit', persona: 'balanced', bestFor: 'Daily', contextWindow: '1M', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'gemini-2.5-flash-lite', label: '2.5 Flash Lite', description: 'Extrem leicht', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: '1M', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 2 }),
  ],
  groq: [
    model({ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', description: 'Beste Balance Speed/Qualität', tier: 'paid', persona: 'quality', bestFor: 'Quality', contextWindow: '128k', pricePerMillion: '$2 / $8', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'llama-3.1-405b-reasoning', label: 'Llama 3.1 405B', description: 'Höchste Qualität', tier: 'paid', persona: 'quality', bestFor: 'Reasoning', contextWindow: '128k', pricePerMillion: '$5 / $15', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'grok-4', label: 'Grok 4', description: 'Schnell, kreativ', tier: 'credit', persona: 'quality', bestFor: 'Quality/Reasoning', contextWindow: '128k', pricePerMillion: '$3 / $10', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', description: 'Neu & leicht', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: '128k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', description: 'Extrem schnell', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: '128k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Ja', codingStrength: 2 }),
    model({ id: 'qwen3-32b', label: 'Qwen 3 32B', description: 'Sehr starkes Coding', tier: 'credit', persona: 'balanced', bestFor: 'Code / Reasoning', contextWindow: '128k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'mixtral-8x7b-instruct', label: 'Mixtral 8x7B', description: 'Klassiker', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: '128k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'gemma2-9b-it', label: 'Gemma 2 9B', description: 'Schnell & effizient', tier: 'free', persona: 'speed', bestFor: 'Speed/Chat', contextWindow: '128k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Ja', codingStrength: 3 }),
  ],
  huggingface: [
    model({ id: 'Qwen/Qwen3-Coder-235B', label: 'Qwen 3 Coder', description: 'Bestes Open-Source-Coding', tier: 'paid', persona: 'quality', bestFor: 'Code', contextWindow: 'varies', pricePerMillion: '$8 / $20', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'deepseek-ai/DeepSeek-V3.2-Speciale', label: 'DeepSeek V3.2', description: 'Starkes Reasoning', tier: 'credit', persona: 'quality', bestFor: 'Reasoning', contextWindow: 'varies', pricePerMillion: '$7 / $18', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'meta-llama/Llama-4-Maverick', label: 'Llama 4 Maverick', description: 'Neu & leistungsstark', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: 'varies', pricePerMillion: '$6 / $15', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'Qwen/Qwen3-32B', label: 'Qwen 3 32B', description: 'Starkes Coding', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'Qwen/Qwen2.5-72B', label: 'Qwen 2.5 72B', description: 'Solide 72B', tier: 'credit', persona: 'quality', bestFor: 'Quality', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'deepseek-ai/DeepSeek-Coder-V2', label: 'DeepSeek Coder V2', description: 'Sehr coding-orientiert', tier: 'credit', persona: 'quality', bestFor: 'Code', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'deepseek-ai/DeepSeek-R1-7B', label: 'DeepSeek R1 7B', description: 'Schnell & leicht', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'meta-llama/Llama-3.3-70B', label: 'Llama 3.3 70B', description: 'Gute Balance', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'microsoft/Phi-4-14B', label: 'Phi 4 14B', description: 'Effizient & leicht', tier: 'free', persona: 'speed', bestFor: 'Speed/Chat', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 3 }),
  ],
};
