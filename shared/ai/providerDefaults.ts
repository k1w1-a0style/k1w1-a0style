export const SHARED_PROVIDER_DEFAULTS = {
  groq: { speed: 'groq/compound-mini', quality: 'llama-3.3-70b-versatile' },
  gemini: { speed: 'gemini-2.5-flash-lite', quality: 'gemini-2.5-flash' },
  openai: { speed: 'gpt-4o-mini', quality: 'gpt-4o' },
  anthropic: { speed: 'claude-3-5-haiku-20241022', quality: 'claude-sonnet-4-20250514' },
  huggingface: { speed: 'Qwen/Qwen2.5-7B-Instruct', quality: 'Qwen/Qwen2.5-Coder-32B-Instruct' },
} as const;

export type SharedProviderDefaults = typeof SHARED_PROVIDER_DEFAULTS;
