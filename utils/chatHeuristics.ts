/**
 * Chat Heuristics
 * Pure helper functions for ChatScreen request classification and change explanation
 */

import { ProjectFile } from '../contexts/types';
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

/**
 * Erkennt mehrdeutige Builder-Requests die einen Planner-Call benötigen
 */
export const looksAmbiguousBuilderRequest = (s: string): boolean => {
  const t = String(s || '').trim();
  if (!t) return false;

  const genericVerb =
    /\b(baue|bauen|erstelle|erstellen|mach|mache|implementiere|füge hinzu|erweitere|optimiere|korrigiere|fix|repariere|prüfe|checke|verbessere)\b/i.test(
      t,
    );

  if (looksLikeAdviceRequest(t)) return true;
  if (!genericVerb) return false;
  if (looksLikeExplicitFileTask(t)) return false;

  const wc = t.split(/\s+/).filter(Boolean).length;
  if (wc <= 12) return true;
  if (/\b(alles|komplett|gesamt|überall)\b/i.test(t)) return true;

  const hasConcreteNouns =
    /\b(playlist|id3|download|login|auth|api|cache|offline|sync|player|ui|screen|settings|github|terminal|orchestrator|prompt|normalizer)\b/i.test(
      t,
    );

  return !hasConcreteNouns;
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
