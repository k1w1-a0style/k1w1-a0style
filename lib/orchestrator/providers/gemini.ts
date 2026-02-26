// lib/orchestrator/providers/gemini.ts
import type { Quality, LlmMessage, OrchestratorResult } from "../types";
import { stripThinking, splitSystem, toOpenAIInput, fetchTextSafe } from "../helpers";

export async function callGemini(apiKey: string, model: string, messages: LlmMessage[], quality: Quality, signal?: AbortSignal): Promise<OrchestratorResult> {
  try {
    const { system, rest } = splitSystem(messages);
    const temperature = quality === 'quality' ? 0.7 : 0.3;

    // Gemini erwartet Multi-Turn-Konversationen als contents[] mit Rollen.
    // system wird (wenn vorhanden) als systemInstruction gesetzt.
    let contents = rest
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const text = String(m.content ?? '').trim();
        return {
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: text ? [{ text }] : [],
        };
      })
      .filter((c) => Array.isArray((c as any).parts) && (c as any).parts.length > 0);

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

    const body: any = {
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
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      return { ok: false, error: `Gemini API Fehler (${response.status}): ${await fetchTextSafe(response)}` };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('\n');

    const cleaned = stripThinking(String(text || ''));
    if (!cleaned) return { ok: false, error: 'Keine Antwort von Gemini erhalten' };

    return { ok: true, text: cleaned };
  } catch (error: any) {
    if (error?.name === 'AbortError' || signal?.aborted) {
      return { ok: false, error: 'Request abgebrochen' };
    }
    return { ok: false, error: `Gemini Netzwerkfehler: ${error?.message ?? String(error)}` };
  }
}

// ---- HuggingFace (Router / OpenAI-compatible) ----
