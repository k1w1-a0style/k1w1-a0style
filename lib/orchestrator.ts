import { providerRateLimiter } from './RateLimiter';
import SecureKeyManager from './SecureKeyManager';
import { AllAIProviders, PROVIDER_DEFAULTS } from '../contexts/AIContext';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OrchestratorResult {
  ok: boolean;
  text?: string;
  error?: string;
  errors?: string[];
  provider?: string;
  model?: string;
  keysRotated?: number;
  timing?: { startMs: number; endMs: number; durationMs: number };
}

type Quality = 'speed' | 'quality' | 'balanced' | 'review';

function stripThinking(text: string): string {
  if (!text) return '';
  return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, '').replace(/\r/g, '').trim();
}

function resolveModel(provider: AllAIProviders, model: string, quality: Quality): string {
  const isAuto = model === 'auto' || model.startsWith('auto-');
  if (!isAuto) return model;

  const defs = PROVIDER_DEFAULTS?.[provider];
  if (!defs) return model;

  if (quality === 'quality') return defs.quality;
  if (quality === 'speed') return defs.speed;
  // balanced/review -> speed default
  return defs.speed;
}

function splitSystem(messages: LlmMessage[]): { system?: string; rest: LlmMessage[] } {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => String(m.content ?? ''))
    .join('\n')
    .trim();

  const rest = messages.filter((m) => m.role !== 'system');
  return { system: system || undefined, rest };
}

function sanitizeMessages(messages: LlmMessage[]): LlmMessage[] {
  // Kill empty history messages (Streaming placeholder etc.)
  const cleaned = messages
    .map((m) => ({ role: m.role, content: String(m.content ?? '') }))
    .filter((m) => m.content.trim().length > 0);

  // If somehow everything is empty, keep at least a user message
  if (cleaned.length === 0) return [{ role: 'user', content: 'Hi' }];
  return cleaned;
}

function toOpenAIResponsesInput(messages: LlmMessage[]) {
  // IMPORTANT:
  // - user/system blocks -> input_text
  // - assistant blocks   -> output_text
  return messages.map((m) => ({
    role: m.role,
    content: [
      {
        type: m.role === 'assistant' ? 'output_text' : 'input_text',
        text: m.content,
      },
    ],
  }));
}

async function fetchTextSafe(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

export async function runOrchestrator(
  provider: AllAIProviders,
  model: string,
  quality: Quality,
  messages: LlmMessage[],
): Promise<OrchestratorResult> {
  const startMs = Date.now();

  try {
    await providerRateLimiter.checkLimit(provider);

    const apiKey = SecureKeyManager.getCurrentKey(provider);
    if (!apiKey) {
      const endMs = Date.now();
      return {
        ok: false,
        error: `Kein API-Key für ${provider} gefunden. Bitte in Einstellungen konfigurieren.`,
        provider,
        model,
        timing: { startMs, endMs, durationMs: endMs - startMs },
      };
    }

    const resolvedModel = resolveModel(provider, model, quality);
    const safeMessages = sanitizeMessages(messages);

    let result: OrchestratorResult;
    switch (provider) {
      case 'groq':
        result = await callGroq(apiKey, resolvedModel, safeMessages, quality);
        break;
      case 'openai':
        result = await callOpenAI(apiKey, resolvedModel, safeMessages, quality);
        break;
      case 'anthropic':
        result = await callAnthropic(apiKey, resolvedModel, safeMessages, quality);
        break;
      case 'gemini':
        result = await callGemini(apiKey, resolvedModel, safeMessages, quality);
        break;
      case 'huggingface':
        result = await callHuggingFace(apiKey, resolvedModel, safeMessages, quality);
        break;
      default:
        result = { ok: false, error: `Unbekannter Provider: ${provider}` };
    }

    const endMs = Date.now();
    return {
      ...result,
      provider,
      model: resolvedModel,
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  } catch (error: any) {
    const endMs = Date.now();
    return {
      ok: false,
      error: `Orchestrator Fehler: ${error?.message ?? String(error)}`,
      provider,
      model,
      timing: { startMs, endMs, durationMs: endMs - startMs },
    };
  }
}

// ---- Groq ----
async function callGroq(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  quality: Quality,
): Promise<OrchestratorResult> {
  try {
    const temperature = quality === 'quality' ? 0.7 : 0.3;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: quality === 'quality' ? 4096 : 2048,
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `Groq API Fehler (${response.status}): ${await fetchTextSafe(response)}` };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    const cleaned = stripThinking(String(text || ''));
    if (!cleaned) return { ok: false, error: 'Keine Antwort von Groq erhalten' };
    return { ok: true, text: cleaned };
  } catch (error: any) {
    return { ok: false, error: `Groq Netzwerkfehler: ${error?.message ?? String(error)}` };
  }
}

// ---- OpenAI (Responses API) ----
async function callOpenAI(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  quality: Quality,
): Promise<OrchestratorResult> {
  try {
    const temperature = quality === 'quality' ? 0.7 : 0.2;
    const max_output_tokens = quality === 'quality' ? 8192 : 4096;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: toOpenAIResponsesInput(messages),
        temperature,
        // ✅ correct param for Responses API:
        max_output_tokens,
        text: { verbosity: quality === 'quality' ? 'high' : 'low' },
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `OpenAI API Fehler (${response.status}): ${await fetchTextSafe(response)}` };
    }

    const data = await response.json();

    const textFromConvenience = typeof data?.output_text === 'string' ? data.output_text : '';
    const textFromOutput = Array.isArray(data?.output)
      ? data.output
          .flatMap((o: any) => (Array.isArray(o?.content) ? o.content : []))
          .filter((c: any) => c?.type === 'output_text' && typeof c?.text === 'string')
          .map((c: any) => c.text)
          .join('\n')
      : '';

    const text = stripThinking(String(textFromConvenience || textFromOutput || ''));
    if (!text) return { ok: false, error: 'Keine Antwort von OpenAI erhalten' };
    return { ok: true, text };
  } catch (error: any) {
    return { ok: false, error: `OpenAI Netzwerkfehler: ${error?.message ?? String(error)}` };
  }
}

// ---- Anthropic ----
async function callAnthropic(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  quality: Quality,
): Promise<OrchestratorResult> {
  try {
    const { system, rest } = splitSystem(messages);

    const anthropicMessages = rest
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: [{ type: 'text', text: String(m.content ?? '').trim() }],
      }))
      // ✅ remove any empty blocks (Anthropic hard-fails on them)
      .filter((m) => m.content?.[0]?.text?.trim?.().length > 0);

    const safeAnthropicMessages =
      anthropicMessages.length > 0 ? anthropicMessages : [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }];

    const max_tokens = quality === 'quality' ? 8192 : 4096;
    const temperature = quality === 'quality' ? 0.6 : 0.2;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens,
        temperature,
        system: system ?? undefined,
        messages: safeAnthropicMessages,
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `Anthropic API Fehler (${response.status}): ${await fetchTextSafe(response)}` };
    }

    const data = await response.json();
    const text = Array.isArray(data?.content)
      ? data.content
          .filter((b: any) => b?.type === 'text' && typeof b?.text === 'string')
          .map((b: any) => b.text)
          .join('\n')
      : data?.content?.[0]?.text;

    const cleaned = stripThinking(String(text || ''));
    if (!cleaned) return { ok: false, error: 'Keine Antwort von Anthropic erhalten' };
    return { ok: true, text: cleaned };
  } catch (error: any) {
    return { ok: false, error: `Anthropic Netzwerkfehler: ${error?.message ?? String(error)}` };
  }
}

// ---- Gemini ----
async function callGemini(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  quality: Quality,
): Promise<OrchestratorResult> {
  try {
    const prompt = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    const temperature = quality === 'quality' ? 0.7 : 0.3;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature, maxOutputTokens: quality === 'quality' ? 8192 : 4096 },
        }),
      },
    );

    if (!response.ok) {
      return { ok: false, error: `Gemini API Fehler (${response.status}): ${await fetchTextSafe(response)}` };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const cleaned = stripThinking(String(text || ''));
    if (!cleaned) return { ok: false, error: 'Keine Antwort von Gemini erhalten' };
    return { ok: true, text: cleaned };
  } catch (error: any) {
    return { ok: false, error: `Gemini Netzwerkfehler: ${error?.message ?? String(error)}` };
  }
}

// ---- HuggingFace (Router / OpenAI-compatible chat.completions) ----
async function callHuggingFace(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  quality: Quality,
): Promise<OrchestratorResult> {
  try {
    const temperature = quality === 'quality' ? 0.7 : 0.3;
    const max_tokens = quality === 'quality' ? 4096 : 2048;

    // HF router expects OpenAI-compatible "chat.completions" format:
    const hfMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: hfMessages,
        temperature,
        max_tokens,
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `HF API Fehler (${response.status}): ${await fetchTextSafe(response)}` };
    }

    const data = await response.json();
    const raw = data?.choices?.[0]?.message?.content;

    const text =
      typeof raw === 'string'
        ? raw
        : Array.isArray(raw)
          ? raw
              .filter((p: any) => p?.type === 'text' && typeof p?.text === 'string')
              .map((p: any) => p.text)
              .join('\n')
          : '';

    const cleaned = stripThinking(String(text || ''));
    if (!cleaned) return { ok: false, error: 'Keine Antwort von HuggingFace erhalten' };
    return { ok: true, text: cleaned };
  } catch (error: any) {
    return { ok: false, error: `HF Netzwerkfehler: ${error?.message ?? String(error)}` };
  }
}
