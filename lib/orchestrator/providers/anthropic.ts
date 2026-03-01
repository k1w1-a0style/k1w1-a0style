// lib/orchestrator/providers/anthropic.ts
import type { Quality, LlmMessage, OrchestratorResult } from "../types";
import { stripThinking, splitSystem, fetchTextSafe } from "../helpers";

type AnthropicContentBlock = {
  type?: string;
  text?: string;
};

type AnthropicTextBlock = {
  type: 'text';
  text: string;
};

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function callAnthropic(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
  quality: Quality,
  signal?: AbortSignal,
): Promise<OrchestratorResult> {
  try {
    const { system, rest } = splitSystem(messages);

    // ✅ Keine leeren text-blocks (Anthropic 400: "must be non-empty")
    const anthropicMessages = rest
      .filter(m => m.role !== 'system')
      .map((m) => {
        const txt = String(m.content ?? '').trim();
        return {
          role: m.role as 'user' | 'assistant',
          text: txt,
        };
      })
      .filter(m => m.text.length > 0)
      .map((m) => ({
        role: m.role,
        content: [{ type: 'text', text: m.text }],
      }));

    const safeMessages =
      anthropicMessages.length > 0 ? anthropicMessages : [{ role: 'user', content: [{ type: 'text', text: 'Hallo' }] }];

    const max_tokens = quality === 'quality' ? 8192 : 4096;
    const temperature = quality === 'quality' ? 0.6 : 0.2;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      signal,

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
        messages: safeMessages,
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `Anthropic API Fehler (${response.status}): ${await fetchTextSafe(response)}` };
    }

    const data = (await response.json()) as {
      content?: AnthropicContentBlock[];
    };
    const text = Array.isArray(data?.content)
      ? data.content
          .filter((b): b is AnthropicTextBlock => b?.type === 'text' && typeof b?.text === 'string')
          .map((b) => b.text)
          .join('\n')
      : '';

    const cleaned = stripThinking(String(text || ''));
    if (!cleaned) return { ok: false, error: 'Keine Antwort von Anthropic erhalten' };

    return { ok: true, text: cleaned };
  } catch (error: unknown) {
    if (isAbortError(error) || signal?.aborted) {
      return { ok: false, error: "Request abgebrochen" };
    }
    return { ok: false, error: `Anthropic Netzwerkfehler: ${getErrorMessage(error)}` };
  }
}

// ---- Gemini ----
