// lib/orchestrator/providers/huggingface.ts
import type { Quality, LlmMessage, OrchestratorResult } from "../types";
import { stripThinking, splitSystem, toOpenAIInput, fetchTextSafe } from "../helpers";

export async function callHuggingFace(apiKey: string, model: string, messages: LlmMessage[], quality: Quality, signal?: AbortSignal): Promise<OrchestratorResult> {
  try {
    const temperature = quality === 'quality' ? 0.7 : 0.3;

    const tryOnce = async (modelId: string) => {
      const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
        signal,

        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages,
          temperature,
          max_tokens: quality === 'quality' ? 4096 : 2048,
          stream: false,
        }),
      });

      if (!response.ok) {
        return { ok: false as const, status: response.status, body: await fetchTextSafe(response) };
      }

      const data = await response.json();
      const txt = data?.choices?.[0]?.message?.content;
      const cleaned = stripThinking(String(txt || ''));
      if (!cleaned) return { ok: false as const, status: 500, body: 'Keine Antwort von HuggingFace erhalten' };
      return { ok: true as const, text: cleaned };
    };

    // 1) so wie es im UI steht
    const r1 = await tryOnce(model);
    if (r1.ok) return { ok: true, text: r1.text };

    // 2) fallback: viele HF Router Setups erwarten ":hf-inference" suffix
    if (!model.includes(':')) {
      const r2 = await tryOnce(`${model}:hf-inference`);
      if (r2.ok) return { ok: true, text: r2.text };
      return { ok: false, error: `HF API Fehler (${r2.status}): ${r2.body}` };
    }

    return { ok: false, error: `HF API Fehler (${r1.status}): ${r1.body}` };
  } catch (error: any) {
    if (error?.name === "AbortError" || signal?.aborted) {
      return { ok: false, error: "Request abgebrochen" };
    }
    return { ok: false, error: `HF Netzwerkfehler: ${error?.message ?? String(error)}` };
  }

}

