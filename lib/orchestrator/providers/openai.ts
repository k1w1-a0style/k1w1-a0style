// lib/orchestrator/providers/openai.ts
import type { Quality, LlmMessage, OrchestratorResult } from "../types";
import { stripThinking, splitSystem, toOpenAIInput, fetchTextSafe } from "../helpers";

type OpenAIOutputTextChunk = {
  type?: string;
  text?: string;
};

type OpenAIOutputItem = {
  content?: OpenAIOutputTextChunk[];
};

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function callOpenAI(apiKey: string, model: string, messages: LlmMessage[], quality: Quality, signal?: AbortSignal): Promise<OrchestratorResult> {
  try {
    const temperature = quality === 'quality' ? 0.7 : 0.2;
    const max_output_tokens = quality === 'quality' ? 8192 : 4096;

    const isReasoningModel = (m: string) => /^o\d/i.test(m.trim());

    const body: Record<string, unknown> = {
      model,
      input: toOpenAIInput(messages),
      max_output_tokens,
    };

    // Reasoning models (o1/o3) reject temperature → avoid 400s.
    if (!isReasoningModel(model)) {
      body.temperature = temperature;
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      signal,

      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { ok: false, error: `OpenAI API Fehler (${response.status}): ${await fetchTextSafe(response)}` };
    }

    const data = (await response.json()) as {
      output_text?: string;
      output?: OpenAIOutputItem[];
    };

    const textFromConvenience = typeof data?.output_text === 'string' ? data.output_text : '';
    const textFromOutput = Array.isArray(data?.output)
      ? data.output
          .flatMap((o) => (Array.isArray(o?.content) ? o.content : []))
          .filter((c) => c?.type === 'output_text' && typeof c?.text === 'string')
          .map((c) => c.text as string)
          .join('\n')
      : '';

    const text = stripThinking(String(textFromConvenience || textFromOutput || ''));
    if (!text) return { ok: false, error: 'Keine Antwort von OpenAI erhalten' };

    return { ok: true, text };
  } catch (error: unknown) {
    if (isAbortError(error) || signal?.aborted) {
      return { ok: false, error: "Request abgebrochen" };
    }
    return { ok: false, error: `OpenAI Netzwerkfehler: ${getErrorMessage(error)}` };
  }
}

// ---- Anthropic ----
