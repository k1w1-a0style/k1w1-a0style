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
    model({ id: 'claude-4-opus-202502', label: 'claude-4-opus-202502', description: 'Anthropic Spitzenmodell fuer anspruchsvolle Review- und Analyseaufgaben.', tier: 'paid', persona: 'quality', bestFor: 'Quality/Review', contextWindow: '200k', availabilityLabel: 'Mapped Runtime', codingStrength: 5 }),
    model({ id: 'claude-4-sonnet-202502', label: 'claude-4-sonnet-202502', description: 'Anthropic Sonnet-Variante fuer starke Coding-Qualitaet.', tier: 'credit', persona: 'quality', bestFor: 'Code + Reasoning', contextWindow: '200k', availabilityLabel: 'Mapped Runtime', codingStrength: 4 }),
    model({ id: 'claude-4-haiku-202502', label: 'claude-4-haiku-202502', description: 'Schnellere Anthropic-Option fuer taegliche Builder-Loops.', tier: 'credit', persona: 'speed', bestFor: 'Speed', contextWindow: '200k', availabilityLabel: 'Mapped Runtime', codingStrength: 3 }),
    model({ id: 'claude-3.5-sonnet-202410', label: 'claude-3.5-sonnet-202410', description: 'Stabiler Sonnet-Pfad mit date-code Alias fuer Runtime.', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: '200k', availabilityLabel: 'Mapped Runtime', codingStrength: 4 }),
    model({ id: 'claude-3.5-haiku-202410', label: 'claude-3.5-haiku-202410', description: 'Leichter Haiku-Pfad mit date-code Alias fuer Runtime.', tier: 'credit', persona: 'speed', bestFor: 'Speed', contextWindow: '200k', availabilityLabel: 'Mapped Runtime', codingStrength: 3 }),
  ],
  openai: [
    model({ id: 'gpt-5.5-codex', label: 'gpt-5.5-codex', description: 'OpenAI Codex-orientiertes Spitzenmodell fuer Code-Aufgaben.', tier: 'paid', persona: 'quality', bestFor: 'Code + Review', contextWindow: '128k', availabilityLabel: 'Runtime OK', codingStrength: 5 }),
    model({ id: 'gpt-5.4-pro', label: 'gpt-5.4-pro', description: 'OpenAI Pro-Qualitaet fuer tieferes Reasoning.', tier: 'paid', persona: 'quality', bestFor: 'Quality/Review', contextWindow: '128k', availabilityLabel: 'Runtime OK', codingStrength: 5 }),
    model({ id: 'gpt-5.4', label: 'gpt-5.4', description: 'Starker OpenAI-Allrounder.', tier: 'credit', persona: 'balanced', bestFor: 'Allround', contextWindow: '128k', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'gpt-5.4-mini', label: 'gpt-5.4-mini', description: 'Schneller OpenAI Daily Driver.', tier: 'credit', persona: 'speed', bestFor: 'Speed', contextWindow: '128k', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
    model({ id: 'gpt-5.4-nano', label: 'gpt-5.4-nano', description: 'Kleine OpenAI-Variante fuer sehr schnelle Aufgaben.', tier: 'free', persona: 'speed', bestFor: 'Mini-Tasks', contextWindow: '128k', availabilityLabel: 'Runtime OK', codingStrength: 2 }),
    model({ id: 'gpt-4o', label: 'gpt-4o', description: 'Bewaehrter OpenAI-Allrounder als kompatibler Pfad.', tier: 'credit', persona: 'balanced', bestFor: 'Fallback/Allround', contextWindow: '128k', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
  ],
  gemini: [
    model({ id: 'gemini-3.1-pro', label: 'gemini-3.1-pro', description: 'Qualitaetsmodell fuer komplexe Aufgaben und grosses Kontextfenster.', tier: 'paid', persona: 'quality', bestFor: 'Quality/Review', contextWindow: '2M', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'gemini-2.5-pro', label: 'gemini-2.5-pro', description: 'Starke Pro-Option fuer Analyse und Langkontext.', tier: 'paid', persona: 'quality', bestFor: 'Analyse', contextWindow: '2M', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'gemini-3-flash', label: 'gemini-3-flash', description: 'Flash-Kanal, aktuell ueber API-Kompatibilitaetsalias geroutet.', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: '1M', availabilityLabel: 'Mapped Runtime', codingStrength: 3 }),
    model({ id: 'gemini-2.5-flash', label: 'gemini-2.5-flash', description: 'Bewaehrter schneller Gemini-Daily-Driver.', tier: 'credit', persona: 'balanced', bestFor: 'Daily', contextWindow: '1M', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
    model({ id: 'gemini-2.5-flash-lite', label: 'gemini-2.5-flash-lite', description: 'Sehr schnelle, guenstige Gemini-Option.', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: '1M', availabilityLabel: 'Runtime OK', codingStrength: 2 }),
  ],
  groq: [
    model({ id: 'llama-3.3-70b-versatile', label: 'llama-3.3-70b-versatile', description: 'Groq Qualitaetsmodell fuer breite Aufgaben.', tier: 'paid', persona: 'quality', bestFor: 'Quality', contextWindow: '128k', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'llama-3.1-405b-reasoning', label: 'llama-3.1-405b-reasoning', description: 'Groq Reasoning-Schwergewicht.', tier: 'paid', persona: 'quality', bestFor: 'Reasoning', contextWindow: '128k', availabilityLabel: 'Runtime OK', codingStrength: 5 }),
    model({ id: 'grok-4', label: 'grok-4', description: 'Groq-Route fuer grok-4 Modellfamilie.', tier: 'credit', persona: 'quality', bestFor: 'Quality/Reasoning', contextWindow: '128k', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'llama-4-scout-17b-16e-instruct', label: 'llama-4-scout-17b-16e-instruct', description: 'Schneller Scout-Instruct Pfad.', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: '128k', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
    model({ id: 'llama-3.1-8b-instant', label: 'llama-3.1-8b-instant', description: 'Schneller Standard fuer Speed-Modus.', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: '128k', availabilityLabel: 'Runtime OK', codingStrength: 2 }),
    model({ id: 'qwen3-32b', label: 'qwen3-32b', description: 'Qwen ueber Groq, mit Runtime-Namespace-Mapping.', tier: 'credit', persona: 'balanced', bestFor: 'Code / Reasoning', contextWindow: '128k', availabilityLabel: 'Mapped Runtime', codingStrength: 4 }),
    model({ id: 'mixtral-8x7b-instruct', label: 'mixtral-8x7b-instruct', description: 'Mixtral ueber Groq, gemappt auf kanonische API-ID.', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: '128k', availabilityLabel: 'Mapped Runtime', codingStrength: 3 }),
    model({ id: 'gemma2-9b-it', label: 'gemma2-9b-it', description: 'Gemma ueber Groq, gemappt auf Runtime-Kennung.', tier: 'free', persona: 'speed', bestFor: 'Speed/Chat', contextWindow: '128k', availabilityLabel: 'Mapped Runtime', codingStrength: 3 }),
  ],
  huggingface: [
    model({ id: 'Qwen/Qwen3-Coder-235B', label: 'Qwen/Qwen3-Coder-235B', description: 'HF Router Modell fuer starke Coding-Aufgaben.', tier: 'paid', persona: 'quality', bestFor: 'Code', contextWindow: 'varies', availabilityLabel: 'Runtime OK', codingStrength: 5 }),
    model({ id: 'deepseek-ai/DeepSeek-V3.2-Speciale', label: 'deepseek-ai/DeepSeek-V3.2-Speciale', description: 'DeepSeek V3.2 Variante fuer generelle Aufgaben.', tier: 'credit', persona: 'quality', bestFor: 'Reasoning', contextWindow: 'varies', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'meta-llama/Llama-4-Maverick', label: 'meta-llama/Llama-4-Maverick', description: 'Llama-4 Maverick ueber HF Router.', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: 'varies', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'Qwen/Qwen3-32B', label: 'Qwen/Qwen3-32B', description: 'Schneller Qwen 3 Pfad.', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: 'varies', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
    model({ id: 'Qwen/Qwen2.5-72B', label: 'Qwen/Qwen2.5-72B', description: 'Qwen 72B fuer anspruchsvollere Aufgaben.', tier: 'credit', persona: 'quality', bestFor: 'Quality', contextWindow: 'varies', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'deepseek-ai/DeepSeek-Coder-V2', label: 'deepseek-ai/DeepSeek-Coder-V2', description: 'DeepSeek Coder fuer Entwicklungstaetigkeiten.', tier: 'credit', persona: 'quality', bestFor: 'Code', contextWindow: 'varies', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'deepseek-ai/DeepSeek-R1-7B', label: 'deepseek-ai/DeepSeek-R1-7B', description: 'Leichter DeepSeek R1 Pfad fuer schnelle Antworten.', tier: 'free', persona: 'speed', bestFor: 'Speed', contextWindow: 'varies', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
    model({ id: 'meta-llama/Llama-3.3-70B', label: 'meta-llama/Llama-3.3-70B', description: 'Llama 3.3 70B ueber HF Router.', tier: 'credit', persona: 'balanced', bestFor: 'Balanced', contextWindow: 'varies', availabilityLabel: 'Runtime OK', codingStrength: 4 }),
    model({ id: 'microsoft/Phi-4-14B', label: 'microsoft/Phi-4-14B', description: 'Phi-4 fuer kompakte Assistenz-Aufgaben.', tier: 'free', persona: 'speed', bestFor: 'Speed/Chat', contextWindow: 'varies', availabilityLabel: 'Runtime OK', codingStrength: 3 }),
  ],
};
