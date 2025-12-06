// lib/orchestrator.ts – Orchestrator mit sauberem Fallback & HuggingFace-Support
// ✅ AbortController + Timeout pro Request
// ✅ Key-Rotation via AIContext.rotateApiKeyOnError
// ✅ Hugging Face Router (router.huggingface.co) statt alter Inference-API
// ✅ Kein erzwungener HF→Groq-Fallback mehr – Provider-Order kommt aus Config

import { extractJsonArray, safeJsonParse } from '../utils/chatUtils';
import { ProjectFile } from '../contexts/types';
import {
  rotateApiKeyOnError,
  detectMetaFromConfig,
  type AllAIProviders,
} from '../contexts/AIContext';
import { toAppError, logAppError } from '../utils/errorUtils';

export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type QualityMode = 'speed' | 'quality';

type OrchestratorOkResult = {
  ok: true;
  provider: AllAIProviders;
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

const PROVIDERS: AllAIProviders[] = [
  'groq',
  'gemini',
  'openai',
  'anthropic',
  'huggingface',
];

const TIMEOUT_MS = 30000;
const MAX_KEY_RETRIES = 3;

// ============================================
// LOGGING
// ============================================
const log = (level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: any) => {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  // eslint-disable-next-line no-console
  console.log(`[Orchestrator:${level}] ${timestamp} - ${message}${metaStr}`);
};

// ============================================
// REQUEST POOL (verhindert parallele Requests)
// ============================================
const requestPool = new Map<string, AbortController>();

function getRequestKey(provider: AllAIProviders): string {
  return provider;
}

function abortExistingRequest(key: string) {
  const controller = requestPool.get(key);
  if (controller) {
    controller.abort();
    requestPool.delete(key);
    log('INFO', `Abgebrochener Request für ${key}`);
  }
}

function registerRequest(key: string, controller: AbortController) {
  abortExistingRequest(key);
  requestPool.set(key, controller);
}

function cleanupRequest(key: string) {
  requestPool.delete(key);
}

// ============================================
// API-KEY RESOLUTION
// ============================================
function resolveApiKey(provider: AllAIProviders): string | null {
  const g = (globalThis as any) || {};

  // 1) Globale Config (__K1W1_AI_CONFIG)
  try {
    const cfg = g.__K1W1_AI_CONFIG;
    if (cfg?.apiKeys?.[provider]?.[0]) {
      const key = String(cfg.apiKeys[provider][0]);
      log('INFO', `API-Key für ${provider} aus Config geladen`, {
        keyPreview: key.slice(0, 8) + '…',
      });
      return key;
    }
  } catch {
    // ignore
  }

  // 2) Direkt aus globalThis
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
          g.HUGGINGFACE_API_KEY ||
          g.EXPO_PUBLIC_HF_API_KEY ||
          g.HF_API_KEY;
        break;
      default:
        break;
    }
    if (candidate && typeof candidate === 'string' && candidate.trim().length) {
      log('INFO', `API-Key für ${provider} aus globalThis geladen`, {
        keyPreview: candidate.slice(0, 8) + '…',
      });
      return candidate.trim();
    }
  } catch {
    // ignore
  }

  // 3) process.env
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
    const v = (process.env as any)?.[name];
    if (typeof v === 'string' && v.trim().length > 0) {
      log('INFO', `API-Key für ${provider} aus process.env geladen`, {
        envName: name,
      });
      return v.trim();
    }
  }

  const msg = `Kein API-Key für ${provider} gefunden`;
  log('ERROR', msg);
  const appError = toAppError(new Error(msg), {
    code: 'ORCH_NO_API_KEY',
    meta: { provider },
  });
  logAppError(appError, 'resolveApiKey');
  return null;
}

// ============================================
// ERROR-KATEGORISIERUNG
// ============================================
function shouldRotateKey(errorMsg: string): boolean {
  const lower = (errorMsg || '').toLowerCase();
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
  if (isRotatable) log('INFO', 'Fehler ist rotierbar', { errorMsg });
  return isRotatable;
}

function enhanceErrorMessage(provider: AllAIProviders, error: string): string {
  const lower = (error || '').toLowerCase();
  if (lower.includes('https://api-inference.huggingface.co')) {
    return `${provider}: alter Endpoint (api-inference) – bitte 'router.huggingface.co' verwenden.`;
  }
  if (lower.includes('401') || lower.includes('unauthorized')) {
    return `${provider}: API-Key ungültig oder abgelaufen.`;
  }
  if (lower.includes('403')) {
    return `${provider}: Keine Berechtigung.`;
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
    return `${provider}: Netzwerkfehler – Verbindung prüfen.`;
  }
  return `${provider}: ${error}`;
}

// ============================================
// HELPER: OK-RESULT
// ============================================
function buildOkResult(
  provider: AllAIProviders,
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
    timing: { startTime, endTime, durationMs },
  };
}

// ============================================
// PROVIDER CALLS
// ============================================
async function callGroq(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
    signal: controller.signal,
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
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
    generationConfig: { temperature: 0.15, maxOutputTokens: 4096 },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  const json: any = await res.json();
  if (!res.ok) {
    const errorMsg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }
  const text =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ?? JSON.stringify(json);
  return buildOkResult('gemini', model, text, json, startTime);
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = 'https://api.openai.com/v1/chat/completions';
  const body = {
    model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
    signal: controller.signal,
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
  controller: AbortController,
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
    signal: controller.signal,
  });
  const json: any = await res.json();
  if (!res.ok) {
    const errorMsg = json?.error?.message || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }
  const text =
    (Array.isArray(json?.content) && json.content[0]?.text) ||
    json?.content?.[0]?.text ||
    '';
  return buildOkResult('anthropic', model, text, json, startTime);
}

/**
 * Hugging Face – Router API
 * Endpoint: https://router.huggingface.co/models/{model}
 */
async function callHuggingFace(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  controller: AbortController,
): Promise<OrchestratorOkResult> {
  const startTime = Date.now();
  const url = `https://router.huggingface.co/models/${encodeURIComponent(
    model,
  )}`;

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
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  const json: any = await res.json();
  if (!res.ok) {
    const errorMsg =
      json?.error ||
      json?.error?.message ||
      json?.message ||
      json?.estimated_time?.toString() ||
      `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  let text = '';
  if (Array.isArray(json)) {
    if (json[0]?.generated_text) text = json[0].generated_text;
    else if (json[0]?.summary_text) text = json[0].summary_text;
    else if (json[0]?.text) text = json[0].text;
    else text = JSON.stringify(json);
  } else if (typeof json?.generated_text === 'string') {
    text = json.generated_text;
  } else if (typeof json?.text === 'string') {
    text = json.text;
  } else if (json?.choices?.[0]?.text) {
    text = json.choices[0].text;
  } else {
    text = JSON.stringify(json);
  }

  return buildOkResult('huggingface', model, text, json, startTime);
}

// ============================================
// RETRY-LOGIK
// ============================================
async function callProviderWithRetry(
  provider: AllAIProviders,
  model: string,
  messages: LlmMessage[],
): Promise<{ result: OrchestratorOkResult; rotations: number }> {
  let rotations = 0;
  const errors: string[] = [];
  const requestKey = getRequestKey(provider);

  for (let attempt = 0; attempt < MAX_KEY_RETRIES; attempt++) {
    const apiKey = resolveApiKey(provider);
    if (!apiKey) {
      const msg = `Kein API-Key für ${provider} gefunden`;
      const appError = toAppError(new Error(msg), {
        code: 'ORCH_NO_API_KEY',
        meta: { provider, model, attempt: attempt + 1 },
      });
      logAppError(appError, 'callProviderWithRetry');
      throw new Error(msg);
    }

    const controller = new AbortController();
    registerRequest(requestKey, controller);

    log('INFO', `Call ${provider} (Versuch ${attempt + 1}/${MAX_KEY_RETRIES})`, {
      model,
      keyPreview: apiKey.slice(0, 8) + '…',
    });

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      const callPromise = (async () => {
        switch (provider) {
          case 'groq':
            return callGroq(apiKey, model, messages, controller);
          case 'gemini':
            return callGemini(apiKey, model, messages, controller);
          case 'openai':
            return callOpenAI(apiKey, model, messages, controller);
          case 'anthropic':
            return callAnthropic(apiKey, model, messages, controller);
          case 'huggingface':
          default:
            return callHuggingFace(apiKey, model, messages, controller);
        }
      })();

      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(
            new Error(`Timeout nach ${TIMEOUT_MS}ms: ${provider}:${model}`),
          );
        }, TIMEOUT_MS);
      });

      const result = (await Promise.race([
        callPromise,
        timeoutPromise,
      ])) as OrchestratorOkResult;

      if (timeoutId) clearTimeout(timeoutId);

      log('INFO', `✅ Erfolg mit ${provider}`, {
        model,
        rotations,
        durationMs: result.timing?.durationMs,
        textLength: result.text?.length ?? 0,
      });

      cleanupRequest(requestKey);
      return { result, rotations };
    } catch (e: any) {
      if (timeoutId) clearTimeout(timeoutId);
      cleanupRequest(requestKey);

      const errorMsg = e?.message || 'unknown_error';
      const enhancedMsg = enhanceErrorMessage(provider, errorMsg);

      errors.push(`Attempt ${attempt + 1}: ${enhancedMsg}`);

      log('ERROR', 'Provider-Call fehlgeschlagen', {
        provider,
        model,
        attempt: attempt + 1,
        error: errorMsg,
      });

      const appError = toAppError(e, {
        code: 'ORCH_PROVIDER_CALL_FAILED',
        message: enhancedMsg,
        meta: { provider, model, attempt: attempt + 1 },
      });
      logAppError(appError, 'callProviderWithRetry');

      if (shouldRotateKey(errorMsg)) {
        log('INFO', `🔄 Rotiere Key für ${provider}.`);
        const rotated = await rotateApiKeyOnError(provider);
        if (!rotated) {
          const msg = `Alle API-Keys für ${provider} erschöpft: ${enhancedMsg}`;
          const exhaustedError = toAppError(new Error(msg), {
            code: 'ORCH_KEYS_EXHAUSTED',
            meta: { provider, model, attempt: attempt + 1 },
          });
          logAppError(exhaustedError, 'callProviderWithRetry');
          throw new Error(msg);
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
  const appError = toAppError(new Error(finalError), {
    code: 'ORCH_MAX_RETRIES_REACHED',
    meta: { provider, model },
  });
  logAppError(appError, 'callProviderWithRetry');
  throw new Error(finalError);
}

// ============================================
// JSON → FILES
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
    const appError = toAppError(e, { code: 'ORCH_PARSE_FILES_FAILED' });
    logAppError(appError, 'parseFilesFromText');
    return null;
  }
}

// ============================================
// FALLBACK-MECHANIK
// ============================================
async function runSequentialFallback(
  selectedProvider: AllAIProviders,
  selectedModel: string,
  qualityMode: QualityMode,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult | OrchestratorErrorResult> {
  const { provider: primaryProvider, quality } = detectMetaFromConfig(
    selectedProvider,
    selectedModel,
    qualityMode,
  );

  const order: AllAIProviders[] = [...PROVIDERS];
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

      log('INFO', `🔄 Fallback zu ${provider}`, { model: modelForProvider });

      const { result, rotations } = await callProviderWithRetry(
        provider,
        modelForProvider,
        messages,
      );

      return { ...result, quality, keysRotated: rotations };
    } catch (e: any) {
      const message = e?.message || 'unknown_error';
      log('WARN', `Provider ${provider} fehlgeschlagen`, { error: message });

      const appError = toAppError(e, {
        code: 'ORCH_PROVIDER_FALLBACK_FAILED',
        meta: { provider, model: selectedModel, qualityMode },
      });
      logAppError(appError, 'runSequentialFallback');

      errors.push({
        provider,
        error: message,
        timestamp: new Date().toISOString(),
      });

      if (message.includes('Kein API-Key')) {
        continue;
      }
    }
  }

  log('ERROR', 'Alle Provider fehlgeschlagen', { errorCount: errors.length });
  const appError = toAppError(
    new Error(errors[0]?.error || 'Kein Provider war erfolgreich'),
    {
      code: 'ORCH_ALL_PROVIDERS_FAILED',
      meta: { errorCount: errors.length },
    },
  );
  logAppError(appError, 'runSequentialFallback');

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
  selectedProvider: AllAIProviders,
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

  requestPool.forEach((controller) => controller.abort());
  requestPool.clear();

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
    log('ERROR', '❌ Fatal error in Orchestrator', { error: err?.message });

    const appError = toAppError(err, {
      code: 'ORCH_FATAL',
      meta: {
        stage: 'runOrchestrator',
        provider: selectedProvider,
        model: selectedModel,
      },
    });
    logAppError(appError, 'runOrchestrator');

    return {
      ok: false,
      fatal: true,
      error: appError.message || 'fatal_error',
      errors: [],
    };
  } finally {
    requestPool.forEach((controller) => controller.abort());
    requestPool.clear();
  }
}

// ============================================
// PUBLIC API – Quality-Validator (Agent)
// ============================================
export async function runValidatorOrchestrator(
  selectedAgentProvider: AllAIProviders,
  selectedAgentMode: string,
  messages: LlmMessage[],
): Promise<OrchestratorOkResult | OrchestratorErrorResult> {
  log('INFO', '🔍 Validator Orchestrator gestartet', {
    provider: selectedAgentProvider,
    mode: selectedAgentMode,
  });

  requestPool.forEach((controller) => controller.abort());
  requestPool.clear();

  try {
    const result = await runSequentialFallback(
      selectedAgentProvider,
      selectedAgentMode,
      'quality',
      messages,
    );
    return result;
  } catch (err: any) {
    log('ERROR', '❌ Fatal error in Validator', { error: err?.message });

    const appError = toAppError(err, {
      code: 'ORCH_VALIDATOR_FATAL',
      meta: {
        stage: 'runValidatorOrchestrator',
        provider: selectedAgentProvider,
        mode: selectedAgentMode,
      },
    });
    logAppError(appError, 'runValidatorOrchestrator');

    return {
      ok: false,
      fatal: true,
      error: appError.message || 'fatal_error',
      errors: [],
    };
  } finally {
    requestPool.forEach((controller) => controller.abort());
    requestPool.clear();
  }
}
