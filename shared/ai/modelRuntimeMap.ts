export type RuntimeProvider = 'groq' | 'gemini' | 'openai' | 'anthropic' | 'huggingface';

export type RuntimeModelMappingStatus = 'direct' | 'mapped' | 'unsupported';

export type RuntimeModelResolution = {
  visibleModel: string;
  runtimeModel: string;
  status: RuntimeModelMappingStatus;
  note?: string;
};

type ProviderModelRuntimeMap = Record<string, Omit<RuntimeModelResolution, 'visibleModel'>>;

const DIRECT = (model: string): Omit<RuntimeModelResolution, 'visibleModel'> => ({
  runtimeModel: model,
  status: 'direct',
});

const MAPPED = (runtimeModel: string, note: string): Omit<RuntimeModelResolution, 'visibleModel'> => ({
  runtimeModel,
  status: 'mapped',
  note,
});

export const PROVIDER_RUNTIME_MODEL_MAP: Record<RuntimeProvider, ProviderModelRuntimeMap> = {
  anthropic: {
    'claude-4-opus-202502': MAPPED('claude-opus-4-20250514', 'Anthropic API model alias'),
    'claude-4-sonnet-202502': MAPPED('claude-sonnet-4-20250514', 'Anthropic API model alias'),
    'claude-4-haiku-202502': MAPPED('claude-3-5-haiku-20241022', 'Anthropic API model alias'),
    'claude-3.5-sonnet-202410': MAPPED('claude-3-5-sonnet-20241022', 'Anthropic API date-code alias'),
    'claude-3.5-haiku-202410': MAPPED('claude-3-5-haiku-20241022', 'Anthropic API date-code alias'),
  },
  openai: {
    'gpt-5.5-codex': DIRECT('gpt-5.5-codex'),
    'gpt-5.4-pro': DIRECT('gpt-5.4-pro'),
    'gpt-5.4': DIRECT('gpt-5.4'),
    'gpt-5.4-mini': DIRECT('gpt-5.4-mini'),
    'gpt-5.4-nano': DIRECT('gpt-5.4-nano'),
    'gpt-4o': DIRECT('gpt-4o'),
  },
  gemini: {
    'gemini-3.1-pro': DIRECT('gemini-3.1-pro'),
    'gemini-2.5-pro': DIRECT('gemini-2.5-pro'),
    'gemini-3-flash': MAPPED('gemini-2.5-flash', 'Gemini API compatibility alias'),
    'gemini-2.5-flash': DIRECT('gemini-2.5-flash'),
    'gemini-2.5-flash-lite': DIRECT('gemini-2.5-flash-lite'),
  },
  groq: {
    'llama-3.3-70b-versatile': DIRECT('llama-3.3-70b-versatile'),
    'llama-3.1-405b-reasoning': DIRECT('llama-3.1-405b-reasoning'),
    'grok-4': DIRECT('grok-4'),
    'llama-4-scout-17b-16e-instruct': DIRECT('llama-4-scout-17b-16e-instruct'),
    'llama-3.1-8b-instant': DIRECT('llama-3.1-8b-instant'),
    'qwen3-32b': MAPPED('qwen/qwen3-32b', 'Groq runtime uses namespaced qwen id'),
    'mixtral-8x7b-instruct': MAPPED('mixtral-8x7b-32768', 'Groq runtime canonical mixtral id'),
    'gemma2-9b-it': MAPPED('google/gemma2-9b-it', 'Groq runtime canonical gemma id'),
  },
  huggingface: {
    'Qwen/Qwen3-Coder-235B': DIRECT('Qwen/Qwen3-Coder-235B'),
    'deepseek-ai/DeepSeek-V3.2-Speciale': DIRECT('deepseek-ai/DeepSeek-V3.2-Speciale'),
    'meta-llama/Llama-4-Maverick': DIRECT('meta-llama/Llama-4-Maverick'),
    'Qwen/Qwen3-32B': DIRECT('Qwen/Qwen3-32B'),
    'Qwen/Qwen2.5-72B': DIRECT('Qwen/Qwen2.5-72B'),
    'deepseek-ai/DeepSeek-Coder-V2': DIRECT('deepseek-ai/DeepSeek-Coder-V2'),
    'deepseek-ai/DeepSeek-R1-7B': DIRECT('deepseek-ai/DeepSeek-R1-7B'),
    'meta-llama/Llama-3.3-70B': DIRECT('meta-llama/Llama-3.3-70B'),
    'microsoft/Phi-4-14B': DIRECT('microsoft/Phi-4-14B'),
  },
};

export function resolveRuntimeModelId(provider: RuntimeProvider, visibleModel: string): RuntimeModelResolution {
  const id = String(visibleModel || '').trim();
  const mapped = PROVIDER_RUNTIME_MODEL_MAP[provider]?.[id];
  if (mapped) {
    return { visibleModel: id, ...mapped };
  }
  return {
    visibleModel: id,
    runtimeModel: id,
    status: 'unsupported',
    note: `${provider}/${id} ist im Runtime-Mapping nicht hinterlegt.`,
  };
}
