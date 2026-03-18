// lib/orchestrator/providers/gemini.ts
import type { Quality, LlmMessage, OrchestratorResult } from "../types";
import { stripThinking, splitSystem, fetchTextSafe } from "../helpers";

type GeminiPart = {
  text?: string;
};

type GeminiContent = {
  role: 'user' | 'model';
  parts: GeminiPart[];
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function callGemini(apiKey: string, model: string, messages: LlmMessage[], quality: Quality, signal?: AbortSignal): Promise<OrchestratorResult> {
  try {
    const { system, rest } = splitSystem(messages);
    const temperature = quality === 'quality' ? 0.7 : 0.3;

    // Gemini erwartet Multi-Turn-Konversationen als contents[] mit Rollen.
    // system wird (wenn vorhanden) als systemInstruction gesetzt.
    let contents: GeminiContent[] = rest
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const text = String(m.content ?? '').trim();
        const role: GeminiContent['role'] = m.role === 'assistant' ? 'model' : 'user';
        return {
          role,
          parts: text ? [{ text }] : [],
        };
      })
      .filter((c) => c.parts.length > 0);

    // Gemini rejects consecutive messages with the same role (user→user / model→model).
    // Merge consecutive same-role entries by concatenating parts.
    contents = contents.reduce((acc, cur) => {
      const prev = acc[acc.length - 1];
      if (prev && prev.role === cur.role) {
        prev.parts.push(...cur.parts);
      } else {
        acc.push({ ...cur, parts: [...cur.parts] });
      }
      return acc;
    }, [] as typeof contents);


    // Gemini rejects empty contents[] with 400 (e.g. when only system messages exist).
    if (contents.length === 0) {
      contents = [{ role: 'user', parts: [{ text: 'Hallo' }] }];
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: quality === 'quality' ? 8192 : 4096,
      },
    };

    if (system) {
      body.systemInstruction = { parts: [{ text: system }] };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      return { ok: false, error: `Gemini API Fehler (${response.status}): ${await fetchTextSafe(response)}` };
    }

    const data = (await response.json()) as GeminiResponse;
    const text = data?.candidates?.[0]?.content?.parts
      ?.filter((p): p is { text: string } => typeof p?.text === 'string' && p.text.length > 0)
      .map((p) => p.text)
      .join('\n');

    const cleaned = stripThinking(String(text || ''));
    if (!cleaned) return { ok: false, error: 'Keine Antwort von Gemini erhalten' };

    return { ok: true, text: cleaned };
  } catch (error: unknown) {
    if (isAbortError(error) || signal?.aborted) {
      return { ok: false, error: 'Request abgebrochen' };
    }
    return { ok: false, error: `Gemini Netzwerkfehler: ${getErrorMessage(error)}` };
  }
}

// ---- HuggingFace (Router / OpenAI-compatible) ----
