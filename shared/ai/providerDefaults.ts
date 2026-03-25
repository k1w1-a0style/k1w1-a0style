export const SHARED_PROVIDER_DEFAULTS = {
  groq: { speed: 'llama-3.1-8b-instant', quality: 'llama-3.3-70b-versatile' },
  gemini: { speed: 'gemini-2.5-flash-lite', quality: 'gemini-3.1-pro' },
  openai: { speed: 'gpt-5.4-mini', quality: 'gpt-5.4-pro' },
  anthropic: { speed: 'claude-4-haiku-202502', quality: 'claude-4-opus-202502' },
  huggingface: { speed: 'Qwen/Qwen3-32B', quality: 'Qwen/Qwen3-Coder-235B' },
} as const;

export type SharedProviderDefaults = typeof SHARED_PROVIDER_DEFAULTS;
