import { jsonrepair } from "jsonrepair";

/**
 * Extrahiert nur ein JSON-Array aus einem größeren Raw-Text.
 */
export function extractJsonArray(raw: string): string | null {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");

  if (start === -1 || end === -1 || end <= start) return null;

  return raw.slice(start, end + 1);
}

/**
 * Checkt OB der JSON-Kandidat unvollständig wirkt.
 */
export function isJsonTruncated(text: string): boolean {
  let depth = 0;
  for (const ch of text) {
    if (ch === "[" || ch === "{") depth++;
    if (ch === "]" || ch === "}") depth--;
  }
  return depth !== 0;
}

/**
 * Repariert & parsed JSON sicher.
 */
export function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    try {
      const repaired = jsonrepair(text);
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

/**
 * Haupt-Normalizer, der mit ChatGPT/Groq/Gemini Output arbeitet.
 */
export function normalizeResponse(raw: string) {
  const trimmed = raw.trim();

  // 1) Erst JSON-Array extrahieren
  const extracted = extractJsonArray(trimmed);
  const candidate = (extracted ?? trimmed).trim();

  // 2) Nur Warnung – nicht abbrechen
  if (extracted && isJsonTruncated(extracted)) {
    console.warn("[Normalizer] ⚠️ JSON wirkt unvollständig – versuche Reparatur");
  }

  // 3) Reparatur + Parse
  const parsed = safeJsonParse(candidate);

  // 4) Finales Fail-Verhalten erst *nach* Reparatur
  if (!parsed) {
    if (isJsonTruncated(candidate)) {
      return { ok: false, error: "Response appears to be truncated (incomplete JSON)" };
    }
    return { ok: false, error: "Invalid JSON" };
  }

  // 5) Erfolg
  return { ok: true, data: parsed };
}
