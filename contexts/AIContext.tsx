// ... imports bleiben gleich ...

// AVAILABLE MODELS - QWEN ENTFERNT, BESSERE HINZUGEFÜGT
export const AVAILABLE_MODELS: Record<AllAIProviders, ModelConfig[]> = {
  groq: [
    { id: 'auto-groq', label: 'Auto (Llama 3.3 70B)' },
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
    { id: 'groq/compound', label: 'Groq Compound' },
    { id: 'groq/compound-mini', label: 'Groq Compound Mini' },
    { id: 'openai/gpt-oss-120b', label: 'GPT OSS 120B' },
    { id: 'openai/gpt-oss-20b', label: 'GPT OSS 20B' },
    { id: 'moonshotai/kimi-k2-instruct', label: 'Kimi K2' },
  ],
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
};

// ... Rest der Datei bleibt gleich ...
