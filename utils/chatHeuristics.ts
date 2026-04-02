import type { ProjectFile } from '../shared/types/project';

/**
 * Chat Heuristics
 * Pure helper functions for ChatScreen request classification and change explanation
 */


import { LlmMessage } from '../lib/promptEngine';

// ─────────────────────────────────────────────────────────────
// Request Classification Heuristics
// ─────────────────────────────────────────────────────────────

/**
 * Erkennt explizite Datei-Tasks (z.B. "ändere src/App.tsx", "in datei", "package.json")
 */
export const looksLikeExplicitFileTask = (s: string): boolean => {
  return (
    /\b[\w.-]+\/[\w./-]+\.(tsx?|jsx?|ts|js|json|md|yml|yaml|sh|css)\b/i.test(s) ||
    /\bin datei\b/i.test(s) ||
    /\b(package\.json|tsconfig\.json|app\.json|app\.config\.js|eas\.json|metro\.config\.js)\b/i.test(s)
  );
};

/**
 * Erkennt Beratungs-Anfragen (Vorschläge, Review, Analyse, etc.)
 */
export const looksLikeAdviceRequest = (s: string): boolean => {
  const t = String(s || '').trim();
  if (!t) return false;
  return /\b(vorschlag|vorschläge|ideen|review|analyse|bewerte|feedback|verbesserungsvorschläge)\b/i.test(t);
};

const hasConcreteImplementationScope = (raw: string, normalized: string): boolean => {
  const hasQuotedIdentifier = /[„“"'][^„“"'`]{2,}[„“"']/.test(raw);
  const hasNamedUiTarget =
    /\b[A-Z][A-Za-z0-9]+(Screen|Modal|Button|Banner|Card|List|Item|Header|Footer|Hook|View)\b/.test(raw);
  const hasScopedTarget =
    /\b(button|toggle|modal|dialog|sheet|header|footer|banner|badge|card|liste|list|flatlist|screen|seite|view|komponente|component|hook|funktion|state|zustand|icon|farbe|theme|input|formular|field|toolbar|tab|route|stack|composer)\b/.test(
      normalized,
    );
  const hasLocationCue = /\b(in|im|ins|auf|am|bei|unter|für)\b/.test(normalized);
  const hasDirectScopedObject =
    /\b(den|die|das|dem|der|des|einen|eine|einem|einer|mein|meine|meinen|unser|unsere)\s+(button|toggle|modal|dialog|sheet|header|footer|banner|badge|card|liste|list|flatlist|screen|seite|view|komponente|component|hook|funktion|state|zustand|icon|farbe|theme|input|formular|field|toolbar|tab|route|stack|composer)\b/.test(
      normalized,
    );

  return hasQuotedIdentifier || hasNamedUiTarget || (hasScopedTarget && (hasLocationCue || hasDirectScopedObject));
};

/**
 * Erkennt mehrdeutige Builder-Requests die einen Planner-Call benötigen
 */
export const looksAmbiguousBuilderRequest = (s: string): boolean => {
  const t = String(s || '').trim();
  if (!t) return false;
  const normalized = t
    .toLowerCase()
    .replace(/[„“”"'`´]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  const genericVerb =
    /\b(baue|bauen|erstelle|erstellen|mach|mache|implementiere|fuge hinzu|füge hinzu|erweitere|optimiere|korrigiere|fix|repariere|prufe|prüfe|checke|verbessere)\b/.test(
      normalized,
    );

  if (looksLikeAdviceRequest(t)) return true;
  if (!genericVerb) return false;
  if (looksLikeExplicitFileTask(t)) return false;
  if (hasConcreteImplementationScope(t, normalized)) return false;

  const wc = normalized.split(/\s+/).filter(Boolean).length;
  if (wc <= 12) return true;
  if (/\b(alles|komplett|gesamt|uberall|überall)\b/.test(normalized)) return true;

  const hasConcreteNouns =
    /\b(playlist|id3|download|login|auth|api|cache|offline|sync|player|ui|screen|settings|github|terminal|orchestrator|prompt|normalizer)\b/.test(
      normalized,
    );

  return !hasConcreteNouns;
};

export type ChatIntent = 'advice' | 'builder' | 'planner';

export type ChatIntentDecision = {
  intent: ChatIntent;
  confidence: number;
  requiresConfirmation: boolean;
  reason: string;
};

export const classifyChatIntent = (s: string): ChatIntentDecision => {
  const input = String(s || '').trim();
  if (!input) {
    return { intent: 'planner', confidence: 0.4, requiresConfirmation: true, reason: 'empty_input' };
  }

  if (looksLikeAdviceRequest(input)) {
    return { intent: 'advice', confidence: 0.9, requiresConfirmation: false, reason: 'advice_keywords' };
  }

  if (looksLikeExplicitFileTask(input)) {
    return { intent: 'builder', confidence: 0.92, requiresConfirmation: false, reason: 'explicit_file_task' };
  }

  const normalized = input
    .toLowerCase()
    .replace(/[„“”"'`´]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const uncertainIntent = /\b(mach mal|irgendwas|irgendwie|verbesser das|optimier das|fix das)\b/.test(normalized);
  if (uncertainIntent) {
    return { intent: 'planner', confidence: 0.55, requiresConfirmation: true, reason: 'low_signal_generic_intent' };
  }

  if (looksAmbiguousBuilderRequest(input)) {
    return { intent: 'planner', confidence: 0.66, requiresConfirmation: false, reason: 'ambiguous_builder' };
  }

  return { intent: 'builder', confidence: 0.75, requiresConfirmation: false, reason: 'default_builder' };
};

export const looksLikeScoutModeRequest = (s: string): boolean => {
  const t = String(s || '').trim().toLowerCase();
  if (!t) return false;
  return /\b(scout|audit[-\s]?only|nur\s+analyse|nur\s+plan|kein\s+build|ohne\s+build)\b/.test(t);
};

// ─────────────────────────────────────────────────────────────
// Change Explanation Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Erstellt einen Digest der Änderungen für den Explain-Call
 */
export const buildChangeDigest = (
  projectFiles: ProjectFile[],
  finalFiles: ProjectFile[],
  created: string[],
  updated: string[],
): string => {
  const oldMap = new Map(projectFiles.map((f) => [f.path, String(f.content ?? '')]));
  const newMap = new Map(finalFiles.map((f) => [f.path, String(f.content ?? '')]));

  const pick = [
    ...created.map((p) => ({ p, kind: 'NEW' as const })),
    ...updated.map((p) => ({ p, kind: 'UPD' as const })),
  ].slice(0, 8);

  const chunks = pick.map(({ p, kind }) => {
    const oldC = oldMap.get(p) ?? '';
    const newC = newMap.get(p) ?? '';
    const oldLines = oldC ? oldC.split('\n').length : 0;
    const newLines = newC ? newC.split('\n').length : 0;
    const delta = newLines - oldLines;

    const preview = newC.split('\n').slice(0, 14).join('\n');

    return [
      `• ${kind === 'NEW' ? 'NEU' : 'UPDATE'}: ${p}`,
      `  Zeilen: ${oldLines} -> ${newLines} (${delta >= 0 ? '+' : ''}${delta})`,
      `  Preview (Anfang):`,
      preview ? preview : '(leer)',
      '',
    ].join('\n');
  });

  return chunks.join('\n');
};

/**
 * Erstellt die LLM-Messages für den Explain-Call
 */
export const buildExplainMessages = (userRequest: string, digest: string): LlmMessage[] => {
  return [
    {
      role: 'system',
      content:
        'Du bist ein kurzer, pragmatischer Code-Reviewer für eine Expo/React-Native Builder-App.\n' +
        'Aufgabe: Erkläre knapp, was sich an den Dateien ändert und warum das zur Nutzeranfrage passt.\n' +
        'Regeln:\n' +
        '- Max 6 Bulletpoints, sehr kurz.\n' +
        '- Wenn sinnvoll: 1 kleines Snippet (max 12 Zeilen) als ```ts``` oder ```tsx```.\n' +
        '- Keine neuen Dateien erfinden. Keine langen Texte. Kein Roman.',
    },
    {
      role: 'user',
      content:
        `Nutzerwunsch:\n${userRequest}\n\n` +
        `Änderungs-Digest (Auszug):\n${digest}\n\n` +
        'Bitte kurz erklären (was/warum).',
    },
  ];
};
