// lib/promptEngine.ts
// Zentrale Prompt-Logik für den k1w1 APK-Builder


import { buildEffectiveChatWriteHint } from './effectiveWritePolicy';
import { sanitizeFileContentForPrompt, sanitizeTextForLlm } from './promptSanitizer';

import type { ProjectFile } from "../shared/types/project";
export type LlmMessageRole = 'system' | 'user' | 'assistant';

export interface LlmMessage {
  role: LlmMessageRole;
  content: string;
}

// Hilfsfunktion: kleine, komprimierte Projektübersicht für den Prompt
function collectFocusTerms(userFocus: string): string[] {
  const lowered = String(userFocus ?? '').toLowerCase();
  const rawTokens = lowered.match(/[a-z0-9_.\/-]{3,}/g) ?? [];
  const stop = new Set([
    'und', 'oder', 'aber', 'nicht', 'mit', 'ohne', 'dass', 'dies', 'eine', 'einen', 'der', 'die', 'das', 'den', 'dem', 'des',
    'für', 'von', 'auf', 'ist', 'sind', 'bitte', 'kann', 'können', 'soll', 'sollte', 'mach', 'mache', 'baue', 'bauen',
  ]);

  return [...new Set(rawTokens.filter((t) => !stop.has(t)).slice(0, 24))];
}

function fileRelevanceScore(file: ProjectFile, focusTerms: string[]): number {
  const path = String(file.path ?? '').toLowerCase();
  const content = String(file.content ?? '').toLowerCase();
  let score = 0;

  for (const term of focusTerms) {
    if (!term) continue;
    if (path.includes(term)) score += 8;
    if (content.includes(term)) score += 3;
  }

  if (/\b(app|screen|chat|prompt|normalizer|validator|builder|planner|flow)\b/.test(path)) score += 2;
  if (/(^|\/)readme\.md$|(^|\/)todo\.md$|(^|\/)project_checklog\.md$/i.test(path)) score += 1;
  return score;
}

function buildProjectSnapshot(files: ProjectFile[], userFocus = ''): string {
  if (!files || files.length === 0) {
    return 'Es sind aktuell noch keine Projektdateien angelegt.';
  }

  const MAX_FILES = 28;
  const MAX_LINES_PER_FILE = 40;
  const focusTerms = collectFocusTerms(userFocus);

  const prioritized = [...files]
    .map((f, idx) => ({ f, idx, score: fileRelevanceScore(f, focusTerms) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.idx - b.idx;
    })
    .slice(0, MAX_FILES)
    .map(({ f, score }) => {
      const path = f.path;
      const content = sanitizeFileContentForPrompt(f.path, String(f.content ?? ''));
      const lines = content.split('\n').slice(0, MAX_LINES_PER_FILE);
      const relevanceHint = score > 0 ? ` (relevance=${score})` : '';
      return `# ${path}${relevanceHint}\n${lines.join('\n')}`;
    });

  return (
    'Ausschnitt der aktuellen Projektdateien (gekürzt):\n\n' +
    prioritized.join('\n\n') +
    '\n\n(Hinweis: Dies ist nur ein Ausschnitt, nicht das komplette Projekt.)'
  );
}

function buildAllowedPathHint(): string {
  return buildEffectiveChatWriteHint();
}

/**
 * CALL 1: PLANER (Kommunikation)
 * - 1–3 Rückfragen ODER Mini-Plan + Dateiliste + optional 1 Snippet
 * - Kein JSON-only!
 */
export function buildPlannerMessages(
  history: LlmMessage[],
  userContent: string,
  projectFiles: ProjectFile[],
): LlmMessage[] {
  const systemLines: string[] = [];

  systemLines.push('Du bist der k1w1 PLANER. Ziel: bessere Kommunikation, bevor Code geändert wird.');
  systemLines.push('Sprache: Deutsch. Antworte kurz & klar.');
  systemLines.push(
    'Regeln:\n' +
      '1) Wenn Details fehlen: stelle 1–3 kurze Rückfragen.\n' +
      '2) Wenn genug klar ist: gib einen Mini-Plan (max. 6 Bulletpoints) + eine Dateiliste (welche Dateien du ändern würdest und warum).\n' +
      '3) Optional: 1 kleines Code-Snippet in ```ts``` oder ```tsx``` (max. ca. 20 Zeilen).\n' +
      '4) Kein Markdown-Kram außer Code-Fences. Kein JSON-Array in diesem Call.',
  );

  const pathHint = buildAllowedPathHint();
  if (pathHint) systemLines.push(pathHint);

  const systemMessage: LlmMessage = { role: 'system', content: systemLines.join('\n\n') };

  const snapshot = buildProjectSnapshot(projectFiles, userContent);
  const projectMessage: LlmMessage = {
    role: 'system',
    content: 'Kontext – aktueller Projektzustand:\n\n' + snapshot,
  };

  const MAX_HISTORY = 8;
  const trimmedHistory = history.length > MAX_HISTORY ? history.slice(history.length - MAX_HISTORY) : history;

  const userTask: LlmMessage = {
    role: 'user',
    content: 'Nutzerwunsch:\n' + sanitizeTextForLlm(userContent) + '\n\nBitte antworte als PLANER (Fragen ODER Plan+Dateiliste).',
  };

  return [systemMessage, projectMessage, ...trimmedHistory, userTask];
}

/**
 * CALL 2: BUILDER (strict JSON-only)
 */
export function buildBuilderMessages(
  history: LlmMessage[],
  userContent: string,
  projectFiles: ProjectFile[],
): LlmMessage[] {
  const systemIntroLines: string[] = [];

  systemIntroLines.push(
    'Du bist der k1w1 APK-Builder. Deine Aufgabe: bestehenden Expo/React-Native-Code erweitern oder verbessern. ' +
      'Du baust KEIN eigenständiges Demo-Projekt, sondern arbeitest immer im Kontext des vorhandenen Projekts.',
  );

  systemIntroLines.push(
    'Das Projekt ist ein Code-/APK-Builder. Wenn der Nutzer "Baue mir X" sagt, fügst du passende Screens/Components ' +
      'in dieses bestehende Projekt ein, aber startest KEIN komplett neues Template-Projekt.',
  );

  systemIntroLines.push(
    'AUSGABEFORMAT (sehr wichtig): Antworte IMMER NUR mit einem validen JSON-Array von { "path", "content" }. ' +
      'Es darf NICHTS vor oder nach diesem Array stehen.',
  );

  systemIntroLines.push(
    'Jedes Element muss genau diese Felder haben: "path" (string, relativer Pfad) und "content" (string, kompletter Dateiinhalt).',
  );

  systemIntroLines.push(
    'JSON-Dateien wie package.json/tsconfig/app.json müssen reines JSON sein – keine Kommentare, keine Zusatztexte.',
  );

  systemIntroLines.push(
    'Keine Platzhalter, kein Lorem Ipsum, keine TODO-Fragmente. Schreibe echten, vollständigen Code.',
  );

  systemIntroLines.push(
    'Fasse zentrale Projektdateien (package.json, app.config.js, eas.json, metro.config.js, tsconfig.json, .gitignore) NUR an, wenn der Nutzer das explizit verlangt.',
  );

  const pathHint = buildAllowedPathHint();
  if (pathHint) systemIntroLines.push(pathHint);

  const systemMessage: LlmMessage = { role: 'system', content: systemIntroLines.join('\n\n') };

  const snapshot = buildProjectSnapshot(projectFiles, userContent);
  const projectMessage: LlmMessage = {
    role: 'system',
    content:
      'Kontext – aktueller Projektzustand:\n\n' +
      snapshot +
      '\n\nNutze diesen Kontext, um nur die relevanten Dateien zu ändern oder zu ergänzen.',
  };

  const MAX_HISTORY = 10;
  const trimmedHistory = history.length > MAX_HISTORY ? history.slice(history.length - MAX_HISTORY) : history;

  const userTask: LlmMessage = {
    role: 'user',
    content:
      'Aufgabe (aktuelle User-Eingabe):\n' +
      sanitizeTextForLlm(userContent) +
      '\n\nDenke daran: Antworte ausschließlich mit einem JSON-Array von Dateien, ohne zusätzliche Erklärungen.',
  };

  return [systemMessage, projectMessage, ...trimmedHistory, userTask];
}

/**
 * Validator / Agent (optional)
 */
export function buildValidatorMessages(
  originalUserRequest: string,
  aiFiles: ProjectFile[],
  projectFiles: ProjectFile[],
): LlmMessage[] {
  const system: LlmMessage = {
    role: 'system',
    content:
      'Du bist ein strenger Code-Validator für den k1w1 APK-Builder. ' +
      'Du bekommst den ursprünglichen User-Wunsch und die von der Haupt-KI vorgeschlagenen Dateien. ' +
      'Prüfe Konsistenz/JSON/Pfade. Liefere ggf. ein korrigiertes JSON-Array zurück (wieder nur {path, content}).',
  };

  const snapshot = buildProjectSnapshot(projectFiles, originalUserRequest);
  const context: LlmMessage = {
    role: 'system',
    content: 'Ausschnitt des aktuellen Projekts:\n\n' + snapshot,
  };

  const user: LlmMessage = {
    role: 'user',
    content:
      'Ursprüngliche Nutzeranfrage:\n' +
      sanitizeTextForLlm(originalUserRequest) +
      '\n\nHier sind die von der Haupt-KI erzeugten Dateien (JSON-Array). Prüfe sie und liefere ggf. ein verbessertes Array:',
  };

  const aiFilesJson = JSON.stringify(
    aiFiles.map((f) => ({
      path: f.path,
      content: sanitizeFileContentForPrompt(f.path, String(f.content ?? '')),
    })),
    null,
    2,
  );

  const assistantDraft: LlmMessage = { role: 'assistant', content: aiFilesJson };
  return [system, context, user, assistantDraft];
}
