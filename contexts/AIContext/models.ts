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
  groq: { speed: 'qwen3-32b', quality: 'llama-3.3-70b-versatile' },
  openai: { speed: 'gpt-4o', quality: 'gpt-5.4' },
  anthropic: { speed: 'claude-4-haiku-202502', quality: 'claude-4-sonnet-202502' },
  gemini: { speed: 'gemini-3-flash', quality: 'gemini-3.1-pro' },
  huggingface: { speed: 'Qwen/Qwen3-32B', quality: 'Qwen/Qwen3-Coder-235B' },
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
    model({ id: 'claude-4-opus-202502', label: 'Opus 4.6', description: 'Beste Reasoning-, Architektur- und Refactor-Qualität für große Aufgaben.', tier: 'paid', persona: 'quality', bestFor: 'Architektur, große Refactors, Tests', contextWindow: '200k', pricePerMillion: '$15 / $75', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'claude-4-sonnet-202502', label: 'Sonnet 4.6', description: 'Sauberer Multi-File-Code und sehr zuverlässige Ergebnisse.', tier: 'paid', persona: 'quality', bestFor: 'Sauberer Code, Multi-File, Tests', contextWindow: '200k', pricePerMillion: '$3 / $15', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'claude-4-haiku-202502', label: 'Haiku 4.5', description: 'Sehr schnell für kleinere Fixes, Syntax und Boilerplate.', tier: 'credit', persona: 'speed', bestFor: 'Kleine Fixes, Syntax, Boilerplate', contextWindow: '200k', pricePerMillion: '$0.30 / $1.50', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'claude-3.5-sonnet-202410', label: 'Sonnet 3.5', description: 'Stabiler Preis/Leistungs-Favorit für Coding und Reviews.', tier: 'credit', persona: 'balanced', bestFor: 'Stabiler Daily Driver', contextWindow: '200k', pricePerMillion: '$3 / $15', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'claude-3.5-haiku-202410', label: 'Haiku 3.5', description: 'Sehr günstig und schnell für hohe Frequenz.', tier: 'credit', persona: 'speed', bestFor: 'Schnell & günstig', contextWindow: '200k', pricePerMillion: '$0.30 / $1.50', availabilityLabel: 'Ja', codingStrength: 3 }),
  ],
  openai: [
    model({ id: 'gpt-5.4-pro', label: 'GPT-5.4 Pro', description: 'Stark für große Repos, Architektur und agentische Workflows.', tier: 'paid', persona: 'quality', bestFor: 'Große Repos, Architektur, Agent-Workflows', contextWindow: '128k', pricePerMillion: '$15 / $45', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'gpt-5.4', label: 'GPT-5.4', description: 'Solides Reasoning mit starkem Tool-Use und Multi-File-Verständnis.', tier: 'paid', persona: 'quality', bestFor: 'Reasoning, Multi-File, Tool-Use', contextWindow: '128k', pricePerMillion: '$10 / $30', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', description: 'Dediziertes Coding-Modell als robuster Fallback.', tier: 'credit', persona: 'balanced', bestFor: 'Coding-Fallback', contextWindow: '128k', pricePerMillion: '$2 / $6', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', description: 'Schnell für Tests, Boilerplate und kleine Aufgaben.', tier: 'free', persona: 'speed', bestFor: 'Tests, Boilerplate', contextWindow: '128k', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', description: 'Sehr leicht für extrem schnelle Inline-Fixes.', tier: 'free', persona: 'speed', bestFor: 'Inline-Fixes', contextWindow: '128k', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 2 }),
    model({ id: 'gpt-4o', label: 'GPT-4o', description: 'Ausgewogener Klassiker mit gutem Allround-Verhalten.', tier: 'free', persona: 'balanced', bestFor: 'Allround, Chat, Code', contextWindow: '128k', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 4 }),
  ],
  gemini: [
    model({ id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', description: 'Bestes Repo- und Kontext-Verständnis mit sehr großem Kontextfenster.', tier: 'paid', persona: 'quality', bestFor: 'Repo-Verständnis, Langkontext', contextWindow: '2M', pricePerMillion: '$2 / $12', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Starkes Reasoning und sauberer Code für schwierigere Aufgaben.', tier: 'paid', persona: 'quality', bestFor: 'Reasoning, sauberer Code', contextWindow: '2M', pricePerMillion: '$7 / $25', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'gemini-3-flash', label: 'Gemini 3 Flash', description: 'Sehr schnell und gut für Syntax, tägliche Arbeit und Chat.', tier: 'free', persona: 'speed', bestFor: 'Schneller Daily Driver', contextWindow: '1M', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', description: 'Extrem leicht für sehr hohes Volumen.', tier: 'free', persona: 'speed', bestFor: 'Hohes Volumen', contextWindow: '1M', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 2 }),
    model({ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Schnell und zuverlässig im Alltag.', tier: 'free', persona: 'balanced', bestFor: 'Speed & Zuverlässigkeit', contextWindow: '1M', pricePerMillion: '$0 (Quota)', availabilityLabel: 'Ja', codingStrength: 3 }),
  ],
  groq: [
    model({ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', description: 'Beste Balance aus Geschwindigkeit und Qualität.', tier: 'paid', persona: 'quality', bestFor: 'Balance Speed/Qualität', contextWindow: '128k', pricePerMillion: '$2 / $8', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'llama-3.1-405b-reasoning', label: 'Llama 3.1 405B', description: 'Höchste Qualität für tieferes Reasoning.', tier: 'paid', persona: 'quality', bestFor: 'Deep reasoning', contextWindow: '128k', pricePerMillion: '$5 / $15', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'grok-4', label: 'Grok 4', description: 'Schnell, kreativ und stark für explorative Aufgaben.', tier: 'paid', persona: 'balanced', bestFor: 'Kreative Exploration', contextWindow: '128k', pricePerMillion: '$3 / $10', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'llama-4-scout-17b-16e', label: 'Llama 4 Scout', description: 'Leichtes neues Modell für schnelle Antworten.', tier: 'free', persona: 'speed', bestFor: 'Leichte Aufgaben', contextWindow: '128k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', description: 'Extrem schnell für sehr kurze Aufgaben.', tier: 'free', persona: 'speed', bestFor: 'Sehr kurze Tasks', contextWindow: '128k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Ja', codingStrength: 2 }),
    model({ id: 'qwen3-32b', label: 'Qwen 3 32B', description: 'Sehr starkes Coding-Modell mit gutem Preis-/Leistungsverhältnis.', tier: 'free', persona: 'balanced', bestFor: 'Starkes Coding', contextWindow: '128k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'mixtral-8x7b-instruct', label: 'Mixtral 8x7B', description: 'Klassischer OSS-Allrounder für günstige Workloads.', tier: 'free', persona: 'balanced', bestFor: 'Allround-Klassiker', contextWindow: '32k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'gemma2-9b-it', label: 'Gemma 2 9B', description: 'Schnell und effizient für leichte Assistenz-Aufgaben.', tier: 'free', persona: 'speed', bestFor: 'Leichte Assistenz', contextWindow: '32k', pricePerMillion: '$0 (Limit)', availabilityLabel: 'Ja', codingStrength: 3 }),
  ],
  huggingface: [
    model({ id: 'Qwen/Qwen3-Coder-235B', label: 'Qwen 3 Coder', description: 'Sehr starkes Open-Source-Coding-Modell für anspruchsvolle Aufgaben.', tier: 'paid', persona: 'quality', bestFor: 'Bestes OSS Coding', contextWindow: 'varies', pricePerMillion: '$8 / $20', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'deepseek-ai/DeepSeek-V3.2', label: 'DeepSeek V3.2', description: 'Starkes Reasoning und vielseitig für Code und Analyse.', tier: 'paid', persona: 'quality', bestFor: 'Reasoning + Coding', contextWindow: 'varies', pricePerMillion: '$7 / $18', availabilityLabel: 'Ja', codingStrength: 5 }),
    model({ id: 'meta-llama/Llama-4-Maverick', label: 'Llama 4 Maverick', description: 'Neues leistungsstarkes Open-Source-Modell.', tier: 'paid', persona: 'balanced', bestFor: 'Leistungsstarker OSS-Allrounder', contextWindow: 'varies', pricePerMillion: '$6 / $15', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'Qwen/Qwen3-32B', label: 'Qwen 3 32B', description: 'Starkes Coding-Modell im freien Credits-Bereich.', tier: 'free', persona: 'balanced', bestFor: 'Coding mit Credits', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'Qwen/Qwen2.5-72B', label: 'Qwen 2.5 72B', description: 'Solider 72B-Workhorse für anspruchsvollere Aufgaben.', tier: 'free', persona: 'balanced', bestFor: 'Solider 72B-Workhorse', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'deepseek-ai/DeepSeek-Coder-V2', label: 'DeepSeek Coder V2', description: 'Sehr coding-orientiert und stark für Refactors.', tier: 'free', persona: 'quality', bestFor: 'Coding-orientiert', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'deepseek-ai/DeepSeek-R1-7B', label: 'DeepSeek R1 7B', description: 'Schnell und leicht für einfache Aufgaben.', tier: 'free', persona: 'speed', bestFor: 'Schnelle leichte Aufgaben', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 3 }),
    model({ id: 'meta-llama/Llama-3.3-70B', label: 'Llama 3.3 70B', description: 'Gute Balance aus Qualität und Tempo.', tier: 'free', persona: 'balanced', bestFor: 'Balance', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 4 }),
    model({ id: 'microsoft/Phi-4-14B', label: 'Phi 4 14B', description: 'Effizientes leichtes Modell für kleinere Coding-Tasks.', tier: 'free', persona: 'speed', bestFor: 'Effiziente kleinere Tasks', contextWindow: 'varies', pricePerMillion: '$0 (Credits)', availabilityLabel: 'Ja', codingStrength: 3 }),
  ],
};
