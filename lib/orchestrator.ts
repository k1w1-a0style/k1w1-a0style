// lib/orchestrator.ts - MIT AUTO KEY-ROTATION (KORRIGIERT)
import { extractJsonArray, safeJsonParse } from '../utils/chatUtils';
import { ProjectFile } from '../contexts/types';
import type { AllAIProviders } from '../contexts/AIContext';
import { rotateApiKeyOnError } from '../contexts/AIContext';

type ProviderId = AllAIProviders;
export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};
export type QualityMode = 'speed' | 'quality';

type OrchestratorOkResult = {
  ok: true;
  provider: ProviderId;
  model: string;
  quality: 'speed' | 'quality' | 'unknown';
  text: string;
  raw: any;
  files?: ProjectFile[];
  keysRotated?: number;
};

type OrchestratorErrorEntry = {
  provider: string;
  error: string;
};

type OrchestratorErrorResult = {
  ok: false;
  errors: OrchestratorErrorEntry[];
  fatal?: boolean;
  error?: string;
};

const PROVIDERS: ProviderId[] = [
  'groq',
  'gemini',
  'openai',
  'anthropic',
  'huggingface',
];

const TIMEOUT_MS = 25000;
const MAX_KEY_RETRIES = 3;

// -------------------------
// Helper: Timeout
// -------------------------
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ]) as Promise<T>;
}

// -------------------------
// Helper: Keys aus Runtime holen
// -------------------------
function resolveApiKey(provider: ProviderId): string | null {
  const g = (globalThis as any) || {};

  try {
    const cfg = g.__K1W1_AI_CONFIG;
    if (cfg?.apiKeys?.[provider]?.[0]) {
      return String(cfg.apiKeys[provider][0]);
    }
  } catch {}

  try {
    let candidate: string | undefined;

    switch (provider) {
      case 'groq':
        candidate = g.GROQ_API_KEY || g.EXPO_PUBLIC_GROQ_API_KEY;
        break;
      case 'gemini':
        candidate = g.GEMINI_API_KEY || g.EXPO_PUBLIC_GEMINI_API_KEY;
        break;
      case 'openai':
        candidate = g.OPENAI_API_KEY || g.EXPO_PUBLIC_OPENAI_API_KEY;
        break;
      case 'anthropic':
        candidate = g.ANTHROPIC_API_KEY || g.EXPO_PUBLIC_ANTHROPIC_API_KEY;
        break;
      case 'huggingface':
        candidate =
          g.HUGGINGFACE_API_KEY || g.EXPO_PUBLIC_HF_API_KEY || g.HF_API_KEY;
        break;
    }

    if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  } catch {}

  const envNames: string[] =
    provider === 'groq'
      ? ['GROQ_API_KEY', 'EXPO_PUBLIC_GROQ_API_KEY']
      : provider === 'gemini'
      ? ['GEMINI_API_KEY', 'EXPO_PUBLIC_GEMINI_API_KEY']
      : provider === 'openai'
      ? ['OPENAI_API_KEY', 'EXPO_PUBLIC_OPENAI_API_KEY']
      : provider === 'anthropic'
      ? ['ANTHROPIC_API_KEY', 'EXPO_PUBLIC_ANTHROPIC_API_KEY']
      : ['HUGGINGFACE_API_KEY', 'EXPO_PUBLIC_HF_API_KEY', 'HF_API_KEY'];

  for (const name of envNames) {
    const v = (process.env as any)[name];
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.trim();
    }
  }

  return null;
}

// -------------------------
// ✅ Helper: Ist Error ein Rate-Limit oder Auth-Error?
// -------------------------
function shouldRotateKey(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  return (
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('too many requests') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key') ||
    lower.includes('invalid_api_key')
  );
}

// -------------------------
// Meta aus Config ableiten
// -------------------------
function detectMetaFromConfig(
  selectedProvider: string,
  selectedModel: string,
  qualityMode: QualityMode,
): {
  provider: ProviderId;
  model: string;
  quality: 'speed' | 'quality' | 'unknown';
} {
  let provider: ProviderId;
  switch (selectedProvider) {
    case 'gemini':
      provider = 'gemini';
      break;
    case 'openai':
      provider = 'openai';
      break;
    case 'anthropic':
      provider = 'anthropic';
      break;
    case 'huggingface':
      provider = 'huggingface';
      break;
    case 'groq':
    default:
      provider = 'groq';
      break;
  }

  let quality: 'speed' | 'quality' | 'unknown' = 'unknown';
  if (qualityMode === 'speed' || qualityMode === 'quality') {
    quality = qualityMode;
  }

  let model = (selectedModel || '').trim();

  if (provider === 'groq') {
    if (!model || model === 'auto-groq') {
      model =
        quality === 'quality'
          ? 'llama-3.3-70b-versatile'
          : 'llama-3.1-8b-instant';
    }
  } else if (provider === 'gemini') {
    if (!model || model === 'auto-gemini' || /llama/i.test(model)) {
      model =
        quality === 'quality'
          ? 'gemini-1.5-pro-latest'
          : 'gemini-1.5-flash-latest';
    }
  } else if (provider === 'openai') {
    if (!model || model === 'auto-openai') {
      model = quality === 'quality' ? 'gpt-4o' : 'gpt-4o-mini';
    }
  } else if (provider === 'anthropic') {
    if (!model || model === 'auto-claude' || model === 'auto-anthropic') {
      model = quality === 'quality' ? 'claude-3-5-sonnet-20241022' : 'claude-3-5-haiku-20241022';
    }
  } else if (provider === 'huggingface') {
    if (!model || model === 'auto-hf') {
      model = 'mistralai/Mistral-7B-Instruct-v0.3';
    }
  }

  if (!model) {
    if (provider === 'groq') model = 'llama-3.1-8b-instant';
    else if (provider === 'gemini') model = 'gemini-1.5-flash-latest';
    else if (provider === 'openai') model = 'gpt-4o-mini';
    else if (provider === 'anthropic') model = 'claude-3-5-haiku-20241022';
    else model = 'mistralai/Mistral-7B-Instruct-v0.3';
  }

  return { provider, model, quality };
}

// -------------------------
// Helper: Files aus Text parsen
// -------------------------
function parseFilesFromText(text: string): ProjectFile[] | null {
  if (!text) return null;

  const extracted = extractJsonArray(text) ?? text;
  const parsed = safeJsonParse<any>(extracted);
  if (!parsed) return null;

  let arr: any = parsed;
  if (!Array.isArray(arr)) {
    if (Array.isArray(parsed?.files)) arr = parsed.files;
    else if (Array.isArray(parsed?.result?.files)) arr = parsed.result.files;
  }

  if (!Array.isArray(arr)) return null;

  const files: ProjectFile[] = [];

  for (const item of arr) {
    if (!item) continue;
    const path = String(item.path ?? '').trim();
    const content =
      item.content == null
        ? ''
        : typeof item.content === 'string'
        ? item.content
        : JSON.stringify(item.content, null, 2);
    if (!path) continue;
    files.push({ path, content });
  }

  return files.length > 0 ? files : null;
}

// -------------------------
// Helper: Ergebnisobjekt bauen
// -------------------------
function buildOkResult(
  provider: ProviderId,
  model: string,
  text: string,
  llmJson: any,
): OrchestratorOkResult {
  const files = parseFilesFromText(text) ?? undefined;
  return {
    ok: true,
    provider,
    model,
    quality: 'unknown',
    text,
    raw: llmJson,
    files,
  };
}

// -------------------------
// Provider-Calls
// -------------------------
async function callGroq(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const body = {
    model,
    messages,
    temperature: 0.15,
    max_tokens: 8192, // ✅ Erhöht von 4096
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json: any = await res.json();

  if (!res.ok) {
    const errorMsg = json?.error?.message || `HTTP ${res.status}`;
    console.log('[Orchestrator] ❌ Groq Fehler:', errorMsg);
    throw new Error(errorMsg);
  }

  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.delta?.content ??
    '';

  return buildOkResult('groq', model, text, json);
}

async function callGemini(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const systemParts = messages
    .filter((m) => m.role === 'system')
    .map((m) => ({ text: m.content }));
  const userParts = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ text: `${m.role.toUpperCase()}: ${m.content}` }));

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              'Du bist ein KI-Codegenerator für eine React Native / Expo App.',
              'Antworte IMMER mit strukturiertem JSON, das eine Liste von Dateien enthält.',
            ].join('\n'),
          },
        ],
      },
      { role: 'model', parts: systemParts },
      { role: 'user', parts: userParts },
    ],
    generationConfig: {
      maxOutputTokens: 8192, // ✅ Erhöht
    },
  };

  const res = await fetch(`${url}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json: any = await res.json();

  if (!res.ok) {
    const errorMsg = json?.error?.message || `HTTP ${res.status}`;
    console.log('[Orchestrator] ❌ Gemini Fehler:', errorMsg);
    throw new Error(errorMsg);
  }

  const text =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ??
    json?.candidates?.[0]?.output_text ??
    '';

  return buildOkResult('gemini', model, text, json);
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult> {
  const url = 'https://api.openai.com/v1/chat/completions';

  const body = {
    model,
    messages,
    temperature: 0.15,
    max_tokens: 8192, // ✅ Erhöht von 4096
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json: any = await res.json();

  if (!res.ok) {
    const errorMsg = json?.error?.message || `HTTP ${res.status}`;
    console.log('[Orchestrator] ❌ OpenAI Fehler:', errorMsg);
    throw new Error(errorMsg);
  }

  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.delta?.content ??
    '';

  return buildOkResult('openai', model, text, json);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult> {
  const url = 'https://api.anthropic.com/v1/messages';

  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');

  const conv = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

  const body: any = {
    model,
    max_tokens: 8192, // ✅ Erhöht von 4096
    messages: conv,
  };

  if (system) {
    body.system = system;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  const json: any = await res.json();

  if (!res.ok) {
    const errorMsg = json?.error?.message || `HTTP ${res.status}`;
    console.log('[Orchestrator] ❌ Anthropic Fehler:', errorMsg);
    throw new Error(errorMsg);
  }

  const text =
    json?.content?.[0]?.text ??
    (Array.isArray(json?.content) && json.content[0]?.text) ??
    '';

  return buildOkResult('anthropic', model, text, json);
}

async function callHuggingFace(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult> {
  const url = `https://api-inference.huggingface.co/models/${model}`;

  const prompt = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const body = {
    inputs: prompt,
    parameters: {
      max_new_tokens: 4096, // ✅ Erhöht von 2048
      temperature: 0.15,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const json: any = await res.json();

  if (!res.ok) {
    const errorMsg = json?.error || `HTTP ${res.status}`;
    console.log('[Orchestrator] ❌ HuggingFace Fehler:', errorMsg);
    throw new Error(errorMsg);
  }

  let text = '';

  if (Array.isArray(json) && json[0]?.generated_text) {
    text = json[0].generated_text;
  } else if (typeof json?.generated_text === 'string') {
    text = json.generated_text;
  } else if (Array.isArray(json) && json[0]?.summary_text) {
    text = json[0].summary_text;
  } else {
    text = JSON.stringify(json);
  }

  return buildOkResult('huggingface', model, text, json);
}

// -------------------------
// ✅ Single Provider mit Retry-Loop
// -------------------------
async function callProviderWithRetry(
  provider: ProviderId,
  model: string,
  messages: LlmMessage[],
): Promise<{ result: OrchestratorOkResult; rotations: number }> {
  let rotations = 0;

  for (let attempt = 0; attempt < MAX_KEY_RETRIES; attempt++) {
    const apiKey = resolveApiKey(provider);

    if (!apiKey) {
      const msg = `missing_api_key_${provider}`;
      console.log('[Orchestrator] ❌ Kein API-Key gefunden für Provider', provider);
      throw new Error(msg);
    }

    console.log(
      `[Orchestrator] ▶️ Call ${provider} (Versuch ${attempt + 1}/${MAX_KEY_RETRIES}), model: ${model}`
    );

    try {
      let result: OrchestratorOkResult;

      if (provider === 'groq') result = await callGroq(apiKey, model, messages);
      else if (provider === 'gemini') result = await callGemini(apiKey, model, messages);
      else if (provider === 'openai') result = await callOpenAI(apiKey, model, messages);
      else if (provider === 'anthropic') result = await callAnthropic(apiKey, model, messages);
      else result = await callHuggingFace(apiKey, model, messages);

      // ✅ Erfolg
      console.log(`✅ [Orchestrator] Erfolg mit ${provider} nach ${rotations} Rotation(en)`);
      return { result, rotations };

    } catch (e: any) {
      const errorMsg = e?.message || 'unknown_error';
      console.log(`⚠️ [Orchestrator] Provider-Fehler (${provider}): ${errorMsg}`);

      // ✅ Prüfen ob rotierbar
      if (shouldRotateKey(errorMsg)) {
        console.log(`🔄 [Orchestrator] Rotiere Key für ${provider}...`);
        const rotated = await rotateApiKeyOnError(provider);

        if (!rotated) {
          // Keine weiteren Keys
          throw new Error(`Alle API-Keys für ${provider} erschöpft: ${errorMsg}`);
        }

        rotations++;
        console.log(`🔄 [Orchestrator] Key rotiert (${rotations}x), nächster Versuch...`);
        continue; // Nächster Versuch

      } else {
        // Nicht-rotierbarer Fehler
        throw e;
      }
    }
  }

  throw new Error(`Max. Versuche (${MAX_KEY_RETRIES}) erreicht für ${provider}`);
}

// -------------------------
// Fallback-Mechanik
// -------------------------
async function runSequentialFallback(
  selectedProvider: string,
  selectedModel: string,
  qualityMode: QualityMode,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult | OrchestratorErrorResult> {
  const {
    provider: primaryProvider,
    model: primaryModel,
    quality,
  } = detectMetaFromConfig(selectedProvider, selectedModel, qualityMode);

  const order: ProviderId[] = [...PROVIDERS];

  if (order.includes(primaryProvider)) {
    order.splice(order.indexOf(primaryProvider), 1);
    order.unshift(primaryProvider);
  }

  const errors: OrchestratorErrorEntry[] = [];

  for (const provider of order) {
    try {
      const metaForProvider = detectMetaFromConfig(
        provider,
        selectedModel,
        qualityMode,
      );

      // ✅ FIX: Immer das provider-spezifische Modell verwenden
      const modelForProvider = metaForProvider.model;

      console.log(`[Orchestrator] 🔄 Fallback zu ${provider} mit Modell: ${modelForProvider}`);

      const { result, rotations } = await withTimeout(
        callProviderWithRetry(provider, modelForProvider, messages),
        TIMEOUT_MS
      );

      return { ...result, quality, keysRotated: rotations };

    } catch (e: any) {
      const message = e?.message || 'unknown_error';
      console.log(
        '[Orchestrator] ⚠️ Provider-Fehler:',
        provider,
        '->',
        message,
      );
      errors.push({ provider, error: message });

      if (message.startsWith('missing_api_key_')) {
        continue;
      }
    }
  }

  return {
    ok: false,
    errors,
    fatal: false,
    error: errors[0]?.error || 'no_provider_succeeded',
  };
}

// -------------------------
// Public API – Generator (Builder)
// -------------------------
export async function runOrchestrator(
  selectedProvider: string,
  selectedModel: string,
  qualityMode: QualityMode,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult | OrchestratorErrorResult> {
  try {
    const result = await runSequentialFallback(
      selectedProvider,
      selectedModel,
      qualityMode,
      messages,
    );
    return result;
  } catch (err: any) {
    console.log('[Orchestrator] ❌ Fatal error:', err?.message);
    return {
      ok: false,
      fatal: true,
      error: err?.message || 'fatal_error',
      errors: [],
    };
  }
}

// -------------------------
// Public API – Quality-Validator (Agent)
// -------------------------
export async function runValidatorOrchestrator(
  selectedAgentProvider: string,
  selectedAgentMode: string,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult | OrchestratorErrorResult> {
  try {
    const result = await runSequentialFallback(
      selectedAgentProvider,
      selectedAgentMode,
      'quality',
      messages,
    );
    return result;
  } catch (err: any) {
    console.log('[Orchestrator] ❌ Fatal error (Validator):', err?.message);
    return {
      ok: false,
      fatal: true,
      error: err?.message || 'fatal_error',
      errors: [],
    };
  }
}
