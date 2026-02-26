// lib/orchestrator/providers/groq.ts
import type { Quality, LlmMessage, OrchestratorResult } from "../types";
import { stripThinking, splitSystem, toOpenAIInput, fetchTextSafe } from "../helpers";

export async function callGroq(apiKey: string, model: string, messages: LlmMessage[], quality: Quality, signal?: AbortSignal): Promise<OrchestratorResult> {
  try {
    const temperature = quality === 'quality' ? 0.7 : 0.3;

    const primaryModel = model;
    const fallbackModel = model.startsWith('groq/') ? model.slice('groq/'.length) : model;

    const doRequest = async (m: string) =>
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        signal,

        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: m,
          messages,
          temperature,
          max_tokens: quality === 'quality' ? 4096 : 2048,
        }),
      });

    let response = await doRequest(primaryModel);

    if (!response.ok && fallbackModel !== primaryModel) {
      const bodyTxt = await fetchTextSafe(response);
      const looksLikeModelNotFound =
        response.status === 404 ||
        /model/i.test(bodyTxt) && /(not found|unknown|does not exist|invalid)/i.test(bodyTxt);

      if (looksLikeModelNotFound) {
        // Compat: some Groq deployments expect model id without the "groq/" prefix.
        response = await doRequest(fallbackModel);
      } else {
        return { ok: false, error: `Groq API Fehler (${response.status}): ${bodyTxt}` };
      }
    }

    if (!response.ok) {
      return { ok: false, error: `Groq API Fehler (${response.status}): ${await fetchTextSafe(response)}` };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    const cleaned = stripThinking(String(text || ''));
    if (!cleaned) return { ok: false, error: 'Keine Antwort von Groq erhalten' };

    return { ok: true, text: cleaned };
  } catch (error: any) {
    if (error?.name === "AbortError" || signal?.aborted) {
      return { ok: false, error: "Request abgebrochen" };
    }
return { ok: false, error: `Groq Netzwerkfehler: ${error?.message ?? String(error)}` };
  }
}

// ---- OpenAI (Responses API) ----
