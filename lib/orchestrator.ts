// lib/orchestrator.ts – TEIL 3: Optimiert
// ✅ Besseres Error-Handling mit detaillierten Fehlermeldungen
// ✅ Timeout für jeden Provider-Call (30s)
// ✅ Detailliertes Logging für Debugging
// ✅ Retry-Strategie + Key-Rotation
// ✅ Provider-spezifische Error-Messages

import { extractJsonArray, safeJsonParse } from '../utils/chatUtils';
import { ProjectFile } from '../contexts/types';
import type { AllAIProviders } from '../contexts/AIContext';
import {
  rotateApiKeyOnError,
  AVAILABLE_MODELS,
  PROVIDER_DEFAULTS,
} from '../contexts/AIContext';
import SecureKeyManager from './SecureKeyManager';

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
  timing?: {
    startTime: number;
    endTime: number;
    durationMs: number;
  };
};

type OrchestratorErrorEntry = {
  provider: string;
  error: string;
  timestamp: string;
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

const TIMEOUT_MS = 30000; // 30 Sekunden
const MAX_KEY_RETRIES = 3;

// ============================================
// LOGGING
// ============================================
const log = (
  level: 'INFO' | 'WARN' | 'ERROR',
  message: string,
  meta?: any,
) => {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  // eslint-disable-next-line no-console
  console.log(`[Orchestrator:${level}] ${timestamp} - ${message}${metaStr}`);
};

// ============================================
// TIMEOUT MIT ABORT CONTROLLER
// ============================================
async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  abortController?: AbortController,
): Promise<T> {
  // ✅ FIX: Verwende AbortController für echtes Abort
  const controller = abortController || new AbortController();
  const timeoutId = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort();
    }
  }, ms);

  try {
    const result = await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        if (controller.signal.aborted) {
          reject(
            new Error(`Timeout nach ${ms}ms: ${label || 'orchestrator_call'}`),
          );
          return;
        }
        controller.signal.addEventListener('abort', () => {
          reject(
            new Error(`Timeout nach ${ms}ms: ${label || 'orchestrator_call'}`),
          );
        }, { once: true });
      }),
    ]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================
// API-KEY RESOLUTION (✅ SICHER mit SecureKeyManager)
// ============================================
function resolveApiKey(provider: ProviderId): string | null {
  // ✅ SICHER: Zuerst SecureKeyManager prüfen
  const key = SecureKeyManager.getCurrentKey(provider);
  
  if (key) {
    // ✅ SICHERHEIT: Keine API-Key-Referenzen in Logs
    log('INFO', `API-Key für ${provider} aus SecureKeyManager geladen`);
    return key;
  }

  // Fallback: process.env (nur für Development/Testing)
  if (typeof process !== 'undefined' && process.env) {
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
        log('INFO', `API-Key für ${provider} aus process.env geladen`, {
          envName: name,
        });
        return v.trim();
      }
    }
  }

  log('ERROR', `Kein API-Key für ${provider} gefunden`);
  return null;
}

// ============================================
// ERROR-KATEGORISIERUNG
// ============================================
function shouldRotateKey(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  const isRotatable =
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('too many requests') ||
    lower.includes('401') ||
    lower.includes('403') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid api key') ||
    lower.includes('invalid_api_key');

  if (isRotatable) {
    log('INFO', 'Fehler ist rotierbar', { errorMsg });
  }
  return isRotatable;
}

// Provider-spezifische Fehlermeldungen
function enhanceErrorMessage(provider: ProviderId, error: string): string {
  const lower = error.toLowerCase();

  if (lower.includes('401') || lower.includes('unauthorized')) {
    return `${provider}: API-Key ungültig oder abgelaufen. Bitte prüfe deine Einstellungen.`;
  }
  if (lower.includes('403')) {
    return `${provider}: Keine Berechtigung. API-Key hat nicht die erforderlichen Rechte.`;
  }
  if (lower.includes('429') || lower.includes('rate limit')) {
    return `${provider}: Rate-Limit erreicht. Key wird automatisch rotiert.`;
  }
  if (lower.includes('timeout')) {
    return `${provider}: Timeout – Server antwortet nicht innerhalb von ${
      TIMEOUT_MS / 1000
    }s.`;
  }
  if (lower.includes('network')) {
    return `${provider}: Netzwerkfehler – prüfe deine Internetverbindung.`;
  }

  return `${provider}: ${error}`;
}

// ============================================
// META-DATEN / MODE SELECTION
// ============================================
const isKnownModel = (provider: ProviderId, modelId: string | undefined): boolean => {
  if (!modelId) return false;
  const list = AVAILABLE_MODELS[provider] ?? [];
  return list.some((entry) => entry.id === modelId);
};

function detectMetaFromConfig(
  selectedProvider: string,
  selectedModel: string,
  qualityMode: QualityMode,
): {
  provider: ProviderId;
  model: string;
  quality: 'speed' | 'quality' | 'unknown';
} {
  const provider: ProviderId = PROVIDERS.includes(selectedProvider as ProviderId)
    ? (selectedProvider as ProviderId)
    : 'groq';

  const defaults = PROVIDER_DEFAULTS[provider];

  const quality: 'speed' | 'quality' | 'unknown' =
    qualityMode === 'speed' || qualityMode === 'quality' ? qualityMode : 'unknown';

  const isAutoSelection =
    !selectedModel ||
    selectedModel.startsWith('auto-') ||
    (!!defaults.auto && selectedModel === defaults.auto);

  if (isAutoSelection) {
    const target =
      quality === 'quality'
        ? defaults.quality
        : quality === 'speed'
        ? defaults.speed
        : defaults.speed;
    return { provider, model: target, quality };
  }

  if (isKnownModel(provider, selectedModel)) {
    return { provider, model: selectedModel, quality };
  }

  const fallback =
    quality === 'quality'
      ? defaults.quality
      : quality === 'speed'
      ? defaults.speed
      : defaults.speed;

  return { provider, model: fallback, quality };
}

// ============================================
// HELPER: OK-RESULT
// ============================================
function buildOkResult(
  provider: ProviderId,
  model: string,
  text: string,
  raw: any,
  startTime: number,
): OrchestratorOkResult {
  const endTime = Date.now();
  const durationMs = endTime - startTime;

  return {
    ok: true,
    provider,
    model,
    quality: 'unknown',
    text,
    raw,
    timing: {
      startTime,
      endTime,
      durationMs,
    },
  };
}

// ============================================
// PROVIDER-CALLS
// ============================================
async function callGroq(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  signal?: AbortSignal,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const body = {
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: 0.15,
    max_tokens: 4096,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal, // ✅ FIX: Unterstütze AbortSignal
  });

  const json: any = await res.json();

  if (!res.ok) {
    const errorMsg =
      json?.error?.message || json?.error || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    JSON.stringify(json);

  return buildOkResult('groq', model, text, json, startTime);
}

async function callGemini(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  signal?: AbortSignal,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey,
  )}`;

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: messages
            .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
            .join('\n'),
        },
      ],
    },
  ];

  const body = {
    contents,
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 4096,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal, // ✅ FIX: Unterstütze AbortSignal
  });

  const json: any = await res.json();

  if (!res.ok) {
    const errorMsg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const text =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ??
    JSON.stringify(json);

  return buildOkResult('gemini', model, text, json, startTime);
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  signal?: AbortSignal,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = 'https://api.openai.com/v1/chat/completions';

  const body = {
    model,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    temperature: 0.2,
    max_tokens: 4096,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal, // ✅ FIX: Unterstütze AbortSignal
  });

  const json: any = await res.json();
  if (!res.ok) {
    const errorMsg =
      json?.error?.message || json?.error || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const text =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    JSON.stringify(json);

  return buildOkResult('openai', model, text, json, startTime);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  signal?: AbortSignal,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = 'https://api.anthropic.com/v1/messages';

  const systemPrompt =
    messages.find((m) => m.role === 'system')?.content || '';
  const nonSystem = messages.filter((m) => m.role !== 'system');

  const body = {
    model,
    system: systemPrompt || undefined,
    messages: nonSystem.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
    max_tokens: 4096,
    temperature: 0.2,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal, // ✅ FIX: Unterstütze AbortSignal
  });

  const json: any = await res.json();

  if (!res.ok) {
    const errorMsg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const text =
    json?.content?.[0]?.text ??
    (Array.isArray(json?.content) && json.content[0]?.text) ??
    '';

  return buildOkResult('anthropic', model, text, json, startTime);
}

async function callHuggingFace(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  signal?: AbortSignal,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = `https://api-inference.huggingface.co/models/${model}`;

  const prompt = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n');

  const body = {
    inputs: prompt,
    parameters: {
      max_new_tokens: 4096,
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
    signal, // ✅ FIX: Unterstütze AbortSignal
  });

  const json: any = await res.json();

  if (!res.ok) {
    const errorMsg = json?.error || `HTTP ${res.status}`;
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

  return buildOkResult('huggingface', model, text, json, startTime);
}

// ============================================
// RETRY-LOGIC MIT VERBESSERTEM ERROR-HANDLING
// ============================================
async function callProviderWithRetry(
  provider: ProviderId,
  model: string,
  messages: LlmMessage[],
): Promise<{ result: OrchestratorOkResult; rotations: number }> {
  let rotations = 0;
  const errors: string[] = [];
  const abortController = new AbortController();

  for (let attempt = 0; attempt < MAX_KEY_RETRIES; attempt++) {
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
      const msg = `Kein API-Key für ${provider} gefunden`;
      log('ERROR', msg);
      abortController.abort();
      throw new Error(msg);
    }

    // ✅ SICHERHEIT: Keine API-Key-Referenzen in Logs
    log('INFO', `Call ${provider} (Versuch ${attempt + 1}/${MAX_KEY_RETRIES})`, {
      model,
    });

    try {
      const callPromise = (async () => {
        const signal = abortController.signal;
        if (provider === 'groq') return await callGroq(apiKey, model, messages, signal);
        if (provider === 'gemini')
          return await callGemini(apiKey, model, messages, signal);
        if (provider === 'openai')
          return await callOpenAI(apiKey, model, messages, signal);
        if (provider === 'anthropic')
          return await callAnthropic(apiKey, model, messages, signal);
        return await callHuggingFace(apiKey, model, messages, signal);
      })();

      const result = await withTimeout(
        callPromise,
        TIMEOUT_MS,
        `${provider}:${model}`,
        abortController,
      );

      log('INFO', `✅ Erfolg mit ${provider}`, {
        model,
        rotations,
        durationMs: result.timing?.durationMs,
        textLength: result.text.length,
      });

      return { result, rotations };
    } catch (e: any) {
      const errorMsg = e?.message || 'unknown_error';
      const enhancedMsg = enhanceErrorMessage(provider, errorMsg);

      errors.push(`Attempt ${attempt + 1}: ${enhancedMsg}`);

      log('ERROR', 'Provider-Call fehlgeschlagen', {
        provider,
        model,
        attempt: attempt + 1,
        error: errorMsg,
      });

      if (shouldRotateKey(errorMsg)) {
        log('INFO', `🔄 Rotiere Key für ${provider}.`);
        const rotated = await rotateApiKeyOnError(provider, enhancedMsg);

        if (!rotated) {
          log('ERROR', `Alle Keys für ${provider} erschöpft`);
          throw new Error(
            `Alle API-Keys für ${provider} erschöpft: ${enhancedMsg}`,
          );
        }

        rotations++;
        log('INFO', `Key rotiert (${rotations}x), nächster Versuch.`);
        continue;
      } else {
        throw new Error(enhancedMsg);
      }
    }
  }

  const finalError = `Max. Versuche (${MAX_KEY_RETRIES}) erreicht für ${provider}.\n\n${errors.join(
    '\n',
  )}`;
  log('ERROR', finalError);
  throw new Error(finalError);
}

// ============================================
// JSON → FILES (für spätere Nutzung, falls gebraucht)
// ============================================
export function parseFilesFromText(raw: any): ProjectFile[] | null {
  try {
    const parsed = typeof raw === 'string' ? safeJsonParse(raw) : raw;
    const array = extractJsonArray(parsed);
    if (!array || !Array.isArray(array)) return null;

    const files: ProjectFile[] = array
      .map((f: any) => ({
        path: String(f.path || ''),
        content: String(f.content ?? ''),
      }))
      .filter((f) => f.path && f.content.trim().length > 0);

    return files;
  } catch (e) {
    log('ERROR', 'parseFilesFromText fehlgeschlagen', {
      error: (e as any)?.message,
    });
    return null;
  }
}

// ============================================
// FALLBACK-MECHANIK
// ============================================
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
      const modelForProvider = metaForProvider.model;

      log('INFO', `🔄 Fallback zu ${provider}`, {
        model: modelForProvider,
      });

      const { result, rotations } = await withTimeout(
        callProviderWithRetry(provider, modelForProvider, messages),
        TIMEOUT_MS,
        `Fallback:${provider}`,
      );

      return { ...result, quality, keysRotated: rotations };
    } catch (e: any) {
      const message = e?.message || 'unknown_error';

      log('WARN', `Provider ${provider} fehlgeschlagen`, {
        error: message,
      });

      errors.push({
        provider,
        error: message,
        timestamp: new Date().toISOString(),
      });

      if (message.includes('Kein API-Key')) {
        // nächster Provider versuchen
        continue;
      }
    }
  }

  log('ERROR', 'Alle Provider fehlgeschlagen', {
    errorCount: errors.length,
  });

  return {
    ok: false,
    errors,
    fatal: false,
    error: errors[0]?.error || 'Kein Provider war erfolgreich',
  };
}

// ============================================
// PUBLIC API – Generator (Builder)
// ============================================
export async function runOrchestrator(
  selectedProvider: string,
  selectedModel: string,
  qualityMode: QualityMode,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult | OrchestratorErrorResult> {
  log('INFO', '🚀 Orchestrator gestartet', {
    provider: selectedProvider,
    model: selectedModel,
    quality: qualityMode,
    messageCount: messages.length,
  });

  try {
    const result = await runSequentialFallback(
      selectedProvider,
      selectedModel,
      qualityMode,
      messages,
    );

    if (result.ok) {
      log('INFO', '✅ Orchestrator erfolgreich', {
        provider: result.provider,
        model: result.model,
        durationMs: result.timing?.durationMs,
      });
    } else {
      log('WARN', '⚠️ Orchestrator fehlgeschlagen', {
        errorCount: result.errors.length,
      });
    }

    return result;
  } catch (err: any) {
    log('ERROR', '❌ Fatal error in Orchestrator', {
      error: err?.message,
    });

    return {
      ok: false,
      fatal: true,
      error: err?.message || 'fatal_error',
      errors: [],
    };
  }
}

// ============================================
// PUBLIC API – Quality-Validator (Agent)
// ============================================
export async function runValidatorOrchestrator(
  selectedAgentProvider: string,
  selectedAgentMode: string,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult | OrchestratorErrorResult> {
  log('INFO', '🔍 Validator Orchestrator gestartet', {
    provider: selectedAgentProvider,
    mode: selectedAgentMode,
  });

  try {
    const result = await runSequentialFallback(
      selectedAgentProvider,
      selectedAgentMode,
      'quality',
      messages,
    );
    return result;
  } catch (err: any) {
    log('ERROR', '❌ Fatal error in Validator', {
      error: err?.message,
    });

    return {
      ok: false,
      fatal: true,
      error: err?.message || 'fatal_error',
      errors: [],
    };
  }
}
